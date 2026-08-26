/**
 * MD4 - the driver flow stays inside the design system.
 *
 * Three properties, each of which was false before 2026-08-26:
 *
 *  1. no font size outside the canonical scale
 *  2. no screen reads a fixed theme (`colorTokens.light.*`) - that was the whole
 *     reason the driver dark baselines were byte-identical to the light ones
 *  3. the dark baselines actually differ from the light ones
 *
 * (3) is the one that matters. (1) and (2) are source assertions and could both
 * pass while the screen still rendered one theme; (3) reads the committed
 * baselines and can only pass if the rendered output really does change.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { typographyTokens } from '@/design-system/tokens/typography';

const SCREENS_DIR = join(__dirname, '..', 'screens');
const SNAPSHOT_DIR = join(SCREENS_DIR, '__tests__', '__snapshots__');

const SCREENS = [
  'DriverOrdersListScreen',
  'DriverActiveOrderScreen',
  'DriverOrderDetailScreen',
  'DriverEarningsScreen',
] as const;

const read = (screen: string): string => readFileSync(join(SCREENS_DIR, `${screen}.tsx`), 'utf8');

describe('driver flow design-system compliance (MD4)', () => {
  describe('typography', () => {
    it.each(SCREENS)('%s declares no numeric fontSize', screen => {
      const offenders = read(screen)
        .split('\n')
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter(({ text }) => /fontSize:\s*\d/u.test(text));

      expect(offenders.map(o => `${screen}:${o.line} ${o.text.trim()}`)).toEqual([]);
    });

    it('every fontSize token the driver screens use exists in the scale', () => {
      const scale = typographyTokens.fontSize as Record<string, number>;
      const used = new Set<string>();
      for (const screen of SCREENS) {
        for (const m of read(screen).matchAll(/fontSize:\s*fontSize(?:\.(\w+)|\['([^']+)'\])/gu)) {
          used.add(m[1] ?? m[2] ?? '');
        }
      }
      expect(used.size).toBeGreaterThan(0);
      expect([...used].filter(k => scale[k] === undefined)).toEqual([]);
    });
  });

  describe('theme awareness', () => {
    it.each(SCREENS)('%s does not read a fixed theme palette', screen => {
      // `colorTokens.base.*` is fine - brand and semantic ramps are theme
      // independent. `colorTokens.light.*` / `.dark.*` are not: they pin the
      // screen to one theme regardless of what the provider says.
      const offenders = read(screen)
        .split('\n')
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter(({ text }) => /colorTokens\.(light|dark)\b/u.test(text));

      expect(offenders.map(o => `${screen}:${o.line} ${o.text.trim()}`)).toEqual([]);
    });

    it.each(SCREENS)('%s builds its styles from the theme', screen => {
      expect(read(screen)).toContain('createThemedStyles');
    });
  });

  /*
   * The behavioural half. Phase 3 recorded, as data, that these screens rendered
   * identically in both themes - the light and dark baselines were byte-equal.
   * That was the finding; this is its acceptance criterion.
   */
  describe('committed baselines', () => {
    const baselines = (): Record<string, Record<string, string>> => {
      const out: Record<string, Record<string, string>> = {};
      for (const file of readdirSync(SNAPSHOT_DIR)) {
        const src = readFileSync(join(SNAPSHOT_DIR, file), 'utf8');
        const re = /^exports\[`([^`]+)`\] = `\n?([\s\S]*?)\n?`;$/gmu;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          const name = m[1] ?? '';
          const cell = name.split(' ').slice(-2)[0] ?? '';
          const key = name.replace(` ${cell} `, ' ');
          (out[key] ??= {})[cell] = m[2] ?? '';
        }
      }
      return out;
    };

    it('finds the driver baselines, so a broken walk cannot pass silently', () => {
      expect(Object.keys(baselines()).length).toBeGreaterThan(20);
    });

    it('renders differently in dark than in light', () => {
      const identical: string[] = [];
      let compared = 0;
      for (const [name, cells] of Object.entries(baselines())) {
        const light = cells['standard-light-en'];
        const dark = cells['standard-dark-en'];
        if (light === undefined || dark === undefined) continue;
        compared += 1;
        if (light === dark) identical.push(name);
      }
      expect(compared).toBeGreaterThan(20);
      expect(identical).toEqual([]);
    });
  });
});
