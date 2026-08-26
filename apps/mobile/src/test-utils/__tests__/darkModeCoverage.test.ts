/**
 * Every matrix baseline must actually change between light and dark.
 *
 * This is the acceptance criterion for MD3. A screen that reads
 * `colorTokens.light.*` at module scope renders identically in both themes, and
 * nothing in the suite noticed for as long as those screens existed - the
 * baselines were byte-equal and green. The driver flow was caught that way in
 * Phase 3 and fixed in Phase 5; this generalises the check so the next one
 * cannot hide.
 *
 * It reads the committed baselines rather than the source, so it cannot be
 * satisfied by importing `useTheme` and ignoring it.
 *
 * EXEMPTIONS are surfaces that are deliberately one fixed look regardless of
 * theme. Each needs a reason, and the list is asserted to be exactly what is
 * written here so a screen cannot be quietly added to it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

/**
 * Baselines whose light and dark cells are allowed to match.
 *
 * Empty. The two always-fixed surfaces in the app - the leaderboard's dark
 * gold-accented ground and the welcome splash's brand ground - have no matrix
 * suite yet, so nothing currently needs an exemption. When they get one, they
 * belong here with the reason, not in a snapshot nobody re-reads.
 */
const EXEMPT: ReadonlyArray<{ baseline: string; reason: string }> = [];

const snapshotFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) snapshotFiles(full, out);
    else if (entry.endsWith('.matrix.test.tsx.snap')) out.push(full);
  }
  return out;
};

interface Cells {
  [cell: string]: string;
}

const collect = (): Record<string, Cells> => {
  const out: Record<string, Cells> = {};
  for (const file of snapshotFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    const re = /^exports\[`([^`]+)`\] = `\n?([\s\S]*?)\n?`;$/gmu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1] ?? '';
      const parts = name.split(' ');
      const cell = parts[parts.length - 2] ?? '';
      const baseline = name.replace(` ${cell} `, ' ');
      (out[baseline] ??= {})[cell] = m[2] ?? '';
    }
  }
  return out;
};

describe('dark mode is reachable on every baselined surface (MD3)', () => {
  const baselines = collect();

  it('finds baselines to check, so a broken walk cannot pass silently', () => {
    expect(snapshotFiles(SRC).length).toBeGreaterThan(5);
    expect(Object.keys(baselines).length).toBeGreaterThan(40);
  });

  it('has an exemption list that matches what is documented here', () => {
    // Guards the seam: growing this list is a design decision, and it should
    // show up as a diff on this file rather than as a quietly skipped screen.
    expect(EXEMPT).toEqual([]);
  });

  it('renders differently in dark than in light, on every baseline', () => {
    const exempt = new Set(EXEMPT.map(e => e.baseline));
    const identical: string[] = [];
    let compared = 0;

    for (const [baseline, cells] of Object.entries(baselines)) {
      if (exempt.has(baseline)) continue;
      const light = cells['standard-light-en'];
      const dark = cells['standard-dark-en'];
      if (light === undefined || dark === undefined) continue;
      compared += 1;
      if (light === dark) identical.push(baseline);
    }

    expect(compared).toBeGreaterThan(40);
    expect(identical).toEqual([]);
  });
});
