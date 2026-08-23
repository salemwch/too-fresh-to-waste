#!/usr/bin/env node
/**
 * Find Tailwind colour-opacity modifiers that emit no CSS at all.
 *
 * Tailwind's opacity scale runs in steps of five. A modifier off that scale and
 * not bracketed - `bg-white/8` rather than `bg-white/10` or `bg-white/[0.08]` -
 * produces no rule, so the element renders with no background, no border, no
 * tint. Nothing fails: a missing utility is not an error, it is silence. That
 * is why 23 of them survived on one marketing page through every build.
 *
 * The hard part is not finding `/8`. It is not destroying `w-1/2`, which is a
 * fraction and entirely valid. So this matches only utilities whose `/n` suffix
 * is an alpha channel, and never the layout prefixes that take fractions.
 *
 *   pnpm --filter @foodwaste/web check:opacity        report
 *   pnpm --filter @foodwaste/web check:opacity --fix  rewrite to nearest step
 *
 * Exits non-zero when anything is found, so it can gate CI. The paired test in
 * src/__tests__/design/opacity-scale.test.ts runs the same rule under jest.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import resolveConfig from 'tailwindcss/resolveConfig.js';
import defaultConfig from 'tailwindcss/defaultConfig.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Read the scale from Tailwind itself rather than hardcoding what it is. */
export const OPACITY_SCALE = Object.keys(resolveConfig(defaultConfig).theme.opacity)
  .map(Number)
  .filter(n => Number.isInteger(n))
  .sort((a, b) => a - b);

/** Utilities whose `/n` suffix is an alpha channel, not a fraction. */
const COLOUR_UTILITIES = [
  'bg',
  'text',
  'border',
  'ring',
  'ring-offset',
  'divide',
  'outline',
  'shadow',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'placeholder',
  'caret',
  'accent',
  'decoration',
];

/**
 * Matches `bg-white/8`, `hover:border-t-primary-500/12`, `dark:text-white/8`.
 * The trailing guard rejects `/[0.08]`, which is an explicit arbitrary value and
 * perfectly valid, and `/8.5`, which is not an integer step.
 */
export const MODIFIER_PATTERN = new RegExp(
  String.raw`(?<![\w-])((?:[a-z-]+:)*(?:${COLOUR_UTILITIES.join('|')})-[a-zA-Z0-9-]+)\/(\d{1,3})(?![\w.[-])`,
  'g',
);

/**
 * Nearest step. Ties round up, and a non-zero value never rounds to 0 - a 2%
 * tint is faint on purpose, and rounding it away is a different bug from the
 * one being fixed.
 */
export const nearestStep = (n, scale = OPACITY_SCALE) => {
  const candidates = n > 0 ? scale.filter(v => v > 0) : scale;
  return candidates.reduce((best, v) => {
    const d = Math.abs(v - n);
    const bd = Math.abs(best - n);
    return d < bd || (d === bd && v > best) ? v : best;
  }, candidates[0]);
};

/** Every offence in one file, without touching it. */
export function findDeadModifiers(source, scale = OPACITY_SCALE) {
  const found = [];
  for (const m of source.matchAll(MODIFIER_PATTERN)) {
    const value = Number(m[2]);
    if (scale.includes(value)) continue;
    found.push({
      className: m[0],
      suggestion: `${m[1]}/${nearestStep(value, scale)}`,
      value,
      line: source.slice(0, m.index).split('\n').length,
    });
  }
  return found;
}

/**
 * Tests are skipped: they render no CSS, and this file's own documentation
 * quotes `bg-white/8` as the example of the bug. Rewriting that would edit the
 * explanation into nonsense.
 */
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next']);

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.(d|test|spec)\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

function main() {
  const fix = process.argv.includes('--fix');
  let total = 0;

  for (const file of sourceFiles(join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');
    const dead = findDeadModifiers(source);
    if (dead.length === 0) continue;

    total += dead.length;
    console.log(`\n${relative(ROOT, file).replace(/\\/g, '/')}`);
    for (const d of dead) {
      console.log(`  ${String(d.line).padStart(4)}  ${d.className}  ->  ${d.suggestion}`);
    }

    if (fix) {
      writeFileSync(
        file,
        source.replace(MODIFIER_PATTERN, (whole, util, digits) =>
          OPACITY_SCALE.includes(Number(digits)) ? whole : `${util}/${nearestStep(Number(digits))}`,
        ),
      );
    }
  }

  console.log(`\nTailwind opacity scale: ${OPACITY_SCALE.join(' ')}`);
  if (total === 0) {
    console.log('No dead opacity modifiers.');
    return 0;
  }
  console.log(`${total} dead modifier${total === 1 ? '' : 's'}${fix ? ' - rewritten.' : '.'}`);
  console.log(fix ? 'Re-run without --fix to confirm.' : 'Run with --fix to rewrite.');
  return fix ? 0 : 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  process.exit(main());
}
