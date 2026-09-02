/**
 * M13 - a touchable that pins its box below 44px must compensate with hitSlop.
 *
 * WHAT THIS CAN AND CANNOT SEE
 * ----------------------------
 * The audit found `hitSlop` on 28 of 174 touchables and said, correctly, that
 * whether the other 146 clear 44px "cannot be determined from source - it
 * depends on rendered layout". That is still true and this file does not
 * pretend otherwise.
 *
 * What it does check is the decidable subset: a touchable whose style pins
 * *both* axes with `width`/`height` (or their `min` forms) to a number under
 * 44. For those, no layout pass is needed - the box is that size by
 * construction. Six exist; two had no hitSlop and were fixed on 2026-08-28.
 *
 * A content-sized touchable is not reported, because a false positive on a
 * button that is actually 48px tall would train people to add hitSlop they do
 * not need, and then to ignore this file.
 *
 * WHY hitSlop RATHER THAN A BIGGER BOX
 * ------------------------------------
 * Growing the box moves the icon and reflows the row it sits in. hitSlop
 * extends only the touch region, so the fix is invisible - which is what these
 * findings ask for. It is also the pattern four sibling close buttons in this
 * codebase already use.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');
const MIN_TOUCH_TARGET = 44;

const isExempt = (rel: string): boolean =>
  rel.includes('__tests__') || rel.includes('.test.') || rel.includes('test-utils');

function sourceFiles(dir: string, base = '', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, rel, out);
      continue;
    }
    if (/\.tsx$/u.test(entry) && !isExempt(rel)) out.push(full);
  }
  return out;
}

interface Small {
  file: string;
  style: string;
  width: number;
  height: number;
  hasHitSlop: boolean;
}

const TOUCHABLE = 'TouchableOpacity|Pressable|TouchableHighlight';

const scan = (): Small[] => {
  const out: Small[] = [];

  for (const file of sourceFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    const flat = src.split('\n').join(' ');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const m = /^\s{2,}([a-zA-Z][a-zA-Z0-9]*):\s*\{$/u.exec(lines[i] ?? '');
      const style = m?.[1];
      if (style === undefined) continue;

      // Read the style block by brace depth.
      let depth = 1;
      let body = '';
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        const cur = lines[j] ?? '';
        depth += (cur.match(/\{/gu) ?? []).length;
        depth -= (cur.match(/\}/gu) ?? []).length;
        if (depth > 0) body += `${cur}\n`;
        j++;
      }

      const w = /(?:^|\n)\s*width:\s*(\d+)/u.exec(body) ?? /minWidth:\s*(\d+)/u.exec(body);
      const h = /(?:^|\n)\s*height:\s*(\d+)/u.exec(body) ?? /minHeight:\s*(\d+)/u.exec(body);
      if (!w || !h) continue; // content-sized - undecidable from source

      const width = Number(w[1]);
      const height = Number(h[1]);
      if (width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET) continue;

      // Only care if the style is actually attached to a touchable.
      const attached = new RegExp(`<(?:${TOUCHABLE})[^>]*styles\\.${style}\\b`, 'su').test(flat);
      if (!attached) continue;

      const hasHitSlop = new RegExp(
        `<(?:${TOUCHABLE})[^>]*styles\\.${style}\\b[^>]*hitSlop`,
        'su',
      ).test(flat);

      out.push({
        file: file
          .slice(SRC.length + 1)
          .split('\\')
          .join('/'),
        style,
        width,
        height,
        hasHitSlop,
      });
    }
  }
  return out;
};

describe('touch targets (M13)', () => {
  const small = scan();

  it('scans a non-empty set of screens', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it('still finds the undersized touchables it is meant to police', () => {
    // If the block parser broke, `small` would be empty and the assertion below
    // would pass while checking nothing.
    //
    // Lowered 6 -> 5 on 2026-09-03: the leaderboard redesign removed the
    // ChallengeHeader info button, a 36x36 box that reached 44 only through
    // hitSlop. Its replacement in the navigation header is a real 44x44 box, so
    // it is correctly no longer in this population. The floor tracks the number
    // that actually exist; it is a canary for a broken scan, not a budget.
    expect(small.length).toBeGreaterThanOrEqual(5);
  });

  it('gives every touchable with a pinned sub-44px box a hitSlop', () => {
    const unmitigated = small
      .filter(s => !s.hasHitSlop)
      .map(s => `${s.file} :: styles.${s.style} is ${s.width}x${s.height} with no hitSlop`);

    // Add hitSlop sized to reach 44 on each axis - (44 - box) / 2 per side.
    expect(unmitigated).toEqual([]);
  });
});
