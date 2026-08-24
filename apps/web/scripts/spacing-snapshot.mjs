#!/usr/bin/env node
/**
 * Resolve every spacing-derived Tailwind utility in the source tree to the pixel
 * value it actually renders at, and compare that against a committed baseline.
 *
 * This is the regression gate for the V1 spacing migration (see
 * DESIGN_AUDIT_REPORT.md Part 1). The migration removes a set of numeric
 * `theme.extend.spacing` overrides, which silently changes what `p-4`, `h-10`
 * and `size-4` mean everywhere at once. Type-check and unit tests cannot see
 * that: these are string class names.
 *
 * What it compares is a per-file multiset of `<property-group>:<px>` counts,
 * bucketed by migration category:
 *
 *   A  layout spacing    p* m* gap* space*        MUST NOT CHANGE
 *   B  icon sizing       size-N, square h-N w-N   may change (intentional)
 *   C  box dimensions    w- h- min-* max-h        may change (intentional)
 *   D  positioning       inset top right ... end  MUST NOT CHANGE
 *
 * Counting a multiset rather than line numbers makes the check invariant to
 * lines moving, and invariant to *which* key was used - only the rendered pixel
 * value matters, which is exactly the property the migration must preserve.
 *
 *   pnpm --filter @foodwaste/web check:spacing         compare to baseline
 *   pnpm --filter @foodwaste/web check:spacing --write rewrite the baseline
 *   pnpm --filter @foodwaste/web check:spacing --report full category report
 *
 * Exits non-zero when a locked category (A or D) drifts, so it can gate CI.
 * The paired test in src/__tests__/design/spacing-scale.test.ts runs the same
 * comparison under jest.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import resolveConfig from 'tailwindcss/resolveConfig.js';
import defaultConfig from 'tailwindcss/defaultConfig.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO = join(ROOT, '..', '..');
const BASELINE = join(ROOT, 'scripts', 'spacing-baseline.json');

const SCAN = [join(ROOT, 'src'), join(REPO, 'packages', 'ui', 'src')];
/*
 * 'visual-harness' is the Playwright screenshot scaffold, not product UI. Its
 * spacing is a fixture, so it does not belong in the product baseline.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.turbo',
  'build',
  'visual-harness',
]);

/* ------------------------------------------------------------------ scale -- */

/**
 * The spacing scale as the browser will see it: Tailwind's defaults, with any
 * `theme.extend.spacing` entries from tailwind.config.ts layered on top.
 *
 * The config is TypeScript, so it cannot simply be imported here. The spacing
 * block is a flat object of string literals, which is parsed directly. Anything
 * that does not parse is a hard failure rather than a silent partial read - a
 * half-read scale would make this gate lie, and a gate that lies is worse than
 * no gate (see the always-failing `pnpm audit --recursive` in
 * .claude/rules/dependencies.md).
 */
export function readSpacingScale() {
  const scale = { ...resolveConfig(defaultConfig).theme.spacing };
  const src = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8');

  const block = src.match(/\n\s{6}spacing:\s*\{([\s\S]*?)\n\s{6}\},/);
  if (!block) return scale; // no override present - defaults stand

  const body = block[1];
  const entryRe = /(?:^|\n)\s*'?([\w.-]+)'?\s*:\s*'([^']+)'\s*,/g;
  const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  let m;
  let found = 0;
  while ((m = entryRe.exec(stripped)) !== null) {
    scale[m[1]] = m[2];
    found += 1;
  }

  const declared = (stripped.match(/:\s*'/g) || []).length;
  if (found !== declared) {
    throw new Error(
      `spacing-snapshot: parsed ${found} of ${declared} spacing entries from tailwind.config.ts. ` +
        'Refusing to run against a partially-read scale.',
    );
  }
  return scale;
}

const toPx = value => {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === '0') return 0;
  if (v.endsWith('px')) return parseFloat(v);
  if (v.endsWith('rem')) return parseFloat(v) * 16;
  return null; // %, auto, calc(), etc - not a fixed length, not comparable
};

/* ------------------------------------------------------------- utilities -- */

const GROUPS = {
  A: [
    'p',
    'px',
    'py',
    'pt',
    'pr',
    'pb',
    'pl',
    'ps',
    'pe',
    'm',
    'mx',
    'my',
    'mt',
    'mr',
    'mb',
    'ml',
    'ms',
    'me',
    'gap',
    'gap-x',
    'gap-y',
    'space-x',
    'space-y',
  ],
  C: ['w', 'h', 'min-w', 'min-h', 'max-h', 'size'],
  D: [
    'inset',
    'inset-x',
    'inset-y',
    'top',
    'right',
    'bottom',
    'left',
    'start',
    'end',
    'translate-x',
    'translate-y',
  ],
};

const ALL_PREFIXES = [...GROUPS.A, ...GROUPS.C, ...GROUPS.D].sort((a, b) => b.length - a.length);
const PRE = ALL_PREFIXES.map(p => p.replace(/-/g, '\\-')).join('|');
const KEY = '0\\.5|[0-9]+(?:\\.5)?|xxs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl';

const TOKEN = new RegExp(`(?<![\\w-])-?(${PRE})-(${KEY})(?![\\w.-])`, 'g');
const SQUARE = new RegExp(`(?<![\\w-])(?:h-(${KEY})\\s+w-\\1|w-(${KEY})\\s+h-\\2)(?![\\w.-])`, 'g');

const groupOf = prefix => {
  if (GROUPS.A.includes(prefix)) return 'A';
  if (GROUPS.D.includes(prefix)) return 'D';
  return 'C';
};

/* ------------------------------------------------------------------ scan -- */

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(fp, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      out.push(fp);
    }
  }
  return out;
}

/** Per-file, per-category multiset of `<prefix>:<px>` -> count. */
export function buildSnapshot() {
  const scale = readSpacingScale();
  const files = SCAN.flatMap(d => walk(d));
  const snapshot = {};
  const unresolved = [];

  for (const file of files.sort()) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(REPO, file).replace(/\\/g, '/');

    // Icon idiom: size-N, and square h-N w-N pairs.
    const icons = {};
    let m;
    SQUARE.lastIndex = 0;
    const squareKeys = [];
    while ((m = SQUARE.exec(src)) !== null) squareKeys.push(m[1] ?? m[2]);
    for (const k of squareKeys) {
      const px = toPx(scale[k]);
      if (px === null) continue;
      const id = `square:${px}`;
      icons[id] = (icons[id] || 0) + 1;
    }

    const buckets = { A: {}, B: icons, C: {}, D: {} };

    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src)) !== null) {
      const [, prefix, key] = m;
      const px = toPx(scale[key]);
      if (px === null) {
        unresolved.push(`${rel}  ${prefix}-${key}`);
        continue;
      }
      const bucket = prefix === 'size' ? 'B' : groupOf(prefix);
      const id = `${prefix}:${px}`;
      buckets[bucket][id] = (buckets[bucket][id] || 0) + 1;
    }

    const nonEmpty = Object.fromEntries(
      Object.entries(buckets).filter(([, v]) => Object.keys(v).length > 0),
    );
    if (Object.keys(nonEmpty).length) snapshot[rel] = nonEmpty;
  }

  return { snapshot, unresolved };
}

/* --------------------------------------------------------------- compare -- */

const LOCKED = ['A', 'D'];

/**
 * Physical and logical edges are the same measurement under a different name.
 *
 * `pl-4` and `ps-4` emit an identical box in LTR; the difference is only which
 * edge they bind to when direction flips. This gate exists to answer "did the
 * rendered pixel change", so migrating a physical utility to its logical
 * equivalent must not read as drift - while a genuine side swap (start -> end)
 * still must.
 *
 * Canonicalising to the logical name on both sides of the comparison keeps the
 * committed baseline valid across the V9 migration, which is what proves that
 * nothing *else* moved in the same pass.
 */
const EDGE_ALIAS = { pl: 'ps', pr: 'pe', ml: 'ms', mr: 'me', left: 'start', right: 'end' };

const canonical = bucket =>
  Object.entries(bucket).reduce((acc, [token, n]) => {
    const [prefix, px] = token.split(':');
    const key = `${EDGE_ALIAS[prefix] ?? prefix}:${px}`;
    acc[key] = (acc[key] || 0) + n;
    return acc;
  }, {});

/**
 * shadcn primitives were authored against Tailwind's default scale, so their
 * pixel values are the defect the migration exists to fix: `Card` uses `p-6`
 * meaning 24px and currently renders 40px. Locking category A here would lock
 * the bug in place.
 *
 * They are therefore exempt from the lock - but every change is reported rather
 * than swallowed, because "the gate allows it" must never mean "nobody looked".
 * See the primitives section of the migration report.
 */
const PRIMITIVE = new RegExp("(?:apps/web/src/components/ui|packages/ui/src)/");

export function compare(baseline, current) {
  const drift = [];
  const intentional = [];
  const files = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const f of [...files].sort()) {
    const b = baseline[f] || {};
    const c = current[f] || {};
    for (const cat of ['A', 'B', 'C', 'D']) {
      const bb = canonical(b[cat] || {});
      const cc = canonical(c[cat] || {});
      const keys = new Set([...Object.keys(bb), ...Object.keys(cc)]);
      for (const k of [...keys].sort()) {
        const before = bb[k] || 0;
        const after = cc[k] || 0;
        if (before === after) continue;
        const row = { file: f, category: cat, token: k, before, after };
        const locked = LOCKED.includes(cat) && !PRIMITIVE.test(f);
        if (locked) drift.push(row);
        else intentional.push(row);
      }
    }
  }
  return { drift, intentional };
}

/* ------------------------------------------------------------------- cli -- */

const isMain =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain) {
  const args = process.argv.slice(2);
  const { snapshot, unresolved } = buildSnapshot();

  if (args.includes('--write')) {
    writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + '\n');
    const files = Object.keys(snapshot).length;
    const tokens = Object.values(snapshot).reduce(
      (s, cats) =>
        s +
        Object.values(cats).reduce((t, m) => t + Object.values(m).reduce((a, b) => a + b, 0), 0),
      0,
    );
    console.log(`spacing baseline written: ${files} files, ${tokens} resolved utilities`);
    if (unresolved.length) console.log(`  (${unresolved.length} non-length values skipped)`);
    process.exit(0);
  }

  if (!existsSync(BASELINE)) {
    console.error('No baseline. Run with --write first.');
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const { drift, intentional } = compare(baseline, snapshot);

  if (args.includes('--report')) {
    console.log(`intentional changes (categories B/C): ${intentional.length}`);
    for (const r of intentional.slice(0, 40)) {
      console.log(`  ${r.category}  ${r.file}  ${r.token}  ${r.before} -> ${r.after}`);
    }
    if (intentional.length > 40) console.log(`  ... and ${intentional.length - 40} more`);
  }

  if (drift.length) {
    console.error(`\nLAYOUT DRIFT in locked categories (A/D): ${drift.length}\n`);
    for (const r of drift.slice(0, 50)) {
      console.error(`  ${r.category}  ${r.file}  ${r.token}  ${r.before} -> ${r.after}`);
    }
    if (drift.length > 50) console.error(`  ... and ${drift.length - 50} more`);
    console.error('\nCategory A (layout) and D (positioning) must render identical pixels.');
    process.exit(1);
  }

  console.log(
    `spacing: no drift in locked categories (A/D) across ${Object.keys(snapshot).length} files`,
  );
  if (intentional.length) {
    console.log(
      `         ${intentional.length} intentional change(s) in B/C - run with --report to list`,
    );
  }
}
