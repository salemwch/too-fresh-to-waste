#!/usr/bin/env node
/**
 * Every workspace that compiles with `importHelpers` must declare tslib.
 *
 * `importHelpers: true` makes tsc emit `require("tslib")` at EMIT time. Nothing
 * in source ever writes that import, so it is invisible to source-scanning
 * tools - knip reports the dependency as unused, and removing it breaks the
 * build in a way no type-check or unit test notices.
 *
 * This has now shipped broken twice:
 *   5e9d4ad  removed tslib from the root on knip's advice  -> Render build fell
 *            over in packages/shared (TS2354)
 *   349cca26 declared it in shared + backend only          -> Render build fell
 *            over in packages/email-templates, same error
 *
 * The second failure is the reason this gate exists. Both times the mistake was
 * checking a couple of packages by hand instead of the whole set, and both
 * times local builds stayed green because tslib was reachable transitively
 * through an optional, platform-specific dev dependency that installs on
 * Windows and not on Alpine.
 *
 * The invariant is mechanical, so assert it mechanically across every
 * workspace rather than trusting a spot check.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** tsconfig files are JSONC - strip comments and trailing commas before parsing. */
function readJsonc(file) {
  const raw = readFileSync(file, 'utf8');
  const stripped = raw
    .replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, comment) => (comment ? '' : m))
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}

/**
 * Walk the `extends` chain and return the effective importHelpers value.
 * The nearest definition wins, so a workspace can opt out of the preset.
 */
function effectiveImportHelpers(tsconfigPath, seen = new Set()) {
  if (!existsSync(tsconfigPath) || seen.has(tsconfigPath)) return undefined;
  seen.add(tsconfigPath);

  const cfg = readJsonc(tsconfigPath);
  const own = cfg.compilerOptions?.importHelpers;
  if (own !== undefined) return own;

  if (!cfg.extends) return undefined;
  const parents = Array.isArray(cfg.extends) ? cfg.extends : [cfg.extends];
  // later entries win in TS 5, so resolve right-to-left
  for (const parent of [...parents].reverse()) {
    const resolved = parent.startsWith('.')
      ? resolve(dirname(tsconfigPath), parent)
      : resolvePackageTsconfig(parent);
    if (!resolved) continue;
    const value = effectiveImportHelpers(resolved, seen);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Resolve a bare `extends` like "@foodwaste/tsconfig/base.json" to a real path. */
function resolvePackageTsconfig(spec) {
  const candidates = [
    join(ROOT, 'node_modules', spec),
    join(ROOT, 'node_modules', spec + '.json'),
  ];
  // @foodwaste/* are workspace links; follow them to source
  const workspaceMatch = spec.match(/^@foodwaste\/([^/]+)(?:\/(.+))?$/);
  if (workspaceMatch) {
    const [, pkg, file = 'tsconfig.json'] = workspaceMatch;
    candidates.unshift(join(ROOT, 'packages', pkg, file));
    candidates.unshift(join(ROOT, 'packages', pkg, file + '.json'));
  }
  return candidates.find(existsSync);
}

/** Workspaces are enumerated from disk rather than a hardcoded list. */
function findWorkspaces() {
  const out = [];
  for (const group of ['apps', 'packages']) {
    const base = join(ROOT, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSafe(base)) {
      const dir = join(base, name);
      if (existsSync(join(dir, 'package.json'))) out.push(dir);
    }
  }
  return out;
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const failures = [];
const checked = [];

for (const dir of findWorkspaces()) {
  const tsconfig = join(dir, 'tsconfig.json');
  if (!existsSync(tsconfig)) continue;

  const importHelpers = effectiveImportHelpers(tsconfig);
  if (importHelpers !== true) continue;

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const rel = dir.slice(ROOT.length + 1).replace(/\\/g, '/');
  const declared = pkg.dependencies?.tslib;

  checked.push({ rel, declared });

  // devDependencies is not enough: packages/shared/dist and the backend's dist
  // both carry a runtime `require("tslib")`, so a consumer installing with
  // --prod would resolve nothing and throw MODULE_NOT_FOUND at startup.
  if (!declared) {
    failures.push(
      `  ${rel} - inherits importHelpers:true but does not declare tslib in "dependencies"`,
    );
  }
}

if (checked.length === 0) {
  console.log(
    'tslib gate: no workspace inherits importHelpers - nothing to enforce.\n' +
      'If importHelpers was deliberately turned off, this script and the knip\n' +
      'ignore in knip.config.ts can both be retired.',
  );
  process.exit(0);
}

if (failures.length > 0) {
  console.error('tslib is required by these workspaces but not declared:\n');
  console.error(failures.join('\n'));
  console.error(
    '\nimportHelpers makes tsc emit require("tslib") at build time. Without the\n' +
      'dependency the build fails with TS2354 ("module \'tslib\' cannot be found"),\n' +
      'which is what took the Render deploy down in 5e9d4ad and again after\n' +
      '349cca26. Add tslib to "dependencies" - not devDependencies, the emitted\n' +
      'output requires it at runtime.\n',
  );
  process.exit(1);
}

console.log(
  `tslib gate: ${checked.length} workspaces inherit importHelpers, all declare tslib.`,
);
for (const { rel, declared } of checked) {
  console.log(`  ${rel} -> ${declared}`);
}
