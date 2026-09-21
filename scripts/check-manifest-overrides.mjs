#!/usr/bin/env node
/**
 * Fails when a workspace manifest declares a dependency that the root
 * `pnpm.overrides` has to rescue.
 *
 * ## Why this exists
 *
 * `pnpm audit` reads the *resolved tree*. An override can force a safe version
 * while the app's own `package.json` still pins a vulnerable one, and the audit
 * stays silent because nothing vulnerable is installed. That is how
 * `apps/mobile` sat on `"sharp": "0.35.3"` and the backend on `"joi":
 * "17.13.4"` with a clean audit and three open Dependabot alerts.
 *
 * The divergence matters even when nothing vulnerable runs: narrow the override
 * and the old version returns with no gate failing, installing the workspace
 * alone reintroduces it outright, and the manifest stops being something a
 * reader can trust.
 *
 * ## What it checks
 *
 * For every simple `name: version` override, any workspace declaring that same
 * package at a version the override would have to raise is reported. Only
 * plain-name overrides are considered - `parent>child` and `pkg@range` forms
 * target a specific consumer on purpose, which is exactly what overrides are
 * for, so they are skipped.
 *
 *   node scripts/check-manifest-overrides.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const overrides = root.pnpm?.overrides ?? {};

/** Lowest version a range admits, good enough to compare intent. */
function floorOf(range) {
  const match = String(range).match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isBelow(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

const workspaces = [];
for (const group of ['apps', 'packages']) {
  const dir = join(ROOT, group);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const manifest = join(dir, name, 'package.json');
    if (existsSync(manifest)) workspaces.push([`${group}/${name}`, manifest]);
  }
}

const findings = [];

for (const [label, manifestPath] of workspaces) {
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const [selector, forced] of Object.entries(overrides)) {
    // Skip targeted selectors: `parent>child`, `pkg@range`, `parent@range>child`.
    if (selector.includes('>') || selector.includes('@')) continue;

    const forcedFloor = floorOf(forced);
    if (!forcedFloor) continue;

    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const declared = pkg[field]?.[selector];
      if (!declared) continue;
      if (declared.startsWith('workspace:') || declared.startsWith('catalog:')) continue;

      const declaredFloor = floorOf(declared);
      if (!declaredFloor) continue;

      if (isBelow(declaredFloor, forcedFloor)) {
        findings.push(
          `${label}/package.json  ${field}.${selector} = "${declared}"  ` +
            `but the root override forces "${forced}"`,
        );
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Manifests declaring a version the root overrides have to rescue:\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    '\nRaise the manifest to match. `pnpm audit` cannot see this - it reads the\n' +
      'resolved tree, not the declaration. See .claude/rules/dependencies.md,\n' +
      '"An override can hide a vulnerable pin in an app manifest".',
  );
  process.exit(1);
}

console.log(
  `manifest/override agreement: no workspace under-declares any of the ` +
    `${Object.keys(overrides).filter(k => !k.includes('>') && !k.includes('@')).length} ` +
    `plain-name overrides`,
);
