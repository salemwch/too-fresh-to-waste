/**
 * A Tailwind class off the opacity scale renders nothing, and nothing complains.
 *
 * `bg-white/8` is not `bg-white/10` and not `bg-white/[0.08]`, so Tailwind emits
 * no rule for it. The element gets no background. Type-check passes, the build
 * passes, the page ships with cards that are outlines around empty space - which
 * is exactly what happened on /esg, where 23 of them survived every gate we run.
 *
 * There were 27 across the app when this was written. This test is what stops
 * the 28th, because no other gate can see it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  OPACITY_SCALE,
  findDeadModifiers,
  nearestStep,
} from '../../../scripts/check-opacity-scale.mjs';

const SRC = join(process.cwd(), 'src');
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(entry.name) && !/\.(d|test|spec)\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });
}

describe('the scale is read from Tailwind, not assumed', () => {
  it('runs in steps of five from 0 to 100', () => {
    expect(OPACITY_SCALE[0]).toBe(0);
    expect(OPACITY_SCALE.at(-1)).toBe(100);
    expect(OPACITY_SCALE.every(n => n % 5 === 0)).toBe(true);
  });

  it.each([8, 12, 2, 33])('does not contain %i', n => {
    expect(OPACITY_SCALE).not.toContain(n);
  });
});

describe('detection', () => {
  it.each([
    ['bg-white/8', 'a plain colour utility'],
    ['hover:bg-primary-500/8', 'a variant prefix'],
    ['dark:hover:border-t-white/12', 'stacked variants and a side'],
    ['text-brand-green/8', 'a project colour token'],
  ])('flags %s (%s)', className => {
    expect(findDeadModifiers(`<div className='${className}' />`)).toHaveLength(1);
  });

  it.each([
    ['w-1/2', 'a width fraction'],
    ['translate-x-1/2', 'a transform fraction'],
    ['basis-1/3', 'a flex-basis fraction'],
    ['aspect-w-16', 'no modifier at all'],
    ['bg-white/[0.08]', 'an explicit arbitrary value'],
    ['bg-white/10', 'a value on the scale'],
  ])('leaves %s alone (%s)', className => {
    expect(findDeadModifiers(`<div className='${className}' />`)).toHaveLength(0);
  });

  it('reports every offence in a file, not just the first', () => {
    const found = findDeadModifiers(`bg-white/8 border-white/12 text-black/8`);
    expect(found.map(f => f.className)).toEqual(['bg-white/8', 'border-white/12', 'text-black/8']);
  });
});

describe('the suggested replacement', () => {
  it.each([
    [8, 10],
    [12, 10],
    [2, 5],
    [3, 5],
    [99, 100],
  ])('rounds /%i to /%i', (from, to) => {
    expect(nearestStep(from)).toBe(to);
  });

  it('never rounds a visible tint down to nothing', () => {
    expect(nearestStep(1)).toBe(5);
    expect(nearestStep(2)).toBe(5);
  });

  it('rounds a tie upward', () => {
    // 12.5 is unreachable from integers, so 13 stands in for the tie behaviour.
    expect(nearestStep(13)).toBe(15);
  });
});

describe('the app itself', () => {
  const files = sourceFiles(SRC);

  it('has source files to scan, so this suite is not vacuous', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('uses no opacity modifier Tailwind would silently drop', () => {
    const offences = files.flatMap(file =>
      findDeadModifiers(readFileSync(file, 'utf8')).map(
        d =>
          `${relative(SRC, file).replace(/\\/g, '/')}:${d.line}  ${d.className} -> ${d.suggestion}`,
      ),
    );
    expect(offences).toEqual([]);
  });
});
