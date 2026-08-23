/**
 * /esg carried three kinds of defect that no type-check or build could see, and
 * each one has a guard here because each one is a string in a file.
 *
 *  1. A claim that contradicted our own code. This page said a rescued bag
 *     avoids ~2.5 kg CO₂ while /companies said 5.25 kg. BAG_IMPACT settles it:
 *     avgKgPerBag 1.5 x carbonPerKg 3.5 = 5.25. Two pages, one bag, two
 *     numbers, and nothing anywhere objected.
 *
 *  2. Regulatory dates that Omnibus I falsified in March 2026 while the page
 *     sat unchanged. These cannot be asserted as "correct" by a test, so what
 *     is pinned is that the specific falsified strings do not come back.
 *
 *  3. Tailwind classes that render nothing. The opacity scale runs in steps of
 *     five, so `bg-white/8` emits no rule at all and the element has no
 *     background. There were 23 on this page. The build stays green because a
 *     missing utility is not an error - it is silence.
 *
 * These are source-text assertions, which normally prove very little. They are
 * the right tool for exactly this: the defect *is* the source text, and there
 * is no behaviour to execute. Nothing here is claimed to test rendering.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(process.cwd(), 'src/app/[locale]/(marketing)/esg/page.tsx');
const src = readFileSync(PAGE, 'utf8');

describe('per-bag impact agrees with the backend constants', () => {
  /** apps/food-waste-backend/src/analytics/constants/sustainability.constants.ts */
  const AVG_KG_PER_BAG = 1.5;
  const CARBON_PER_KG = 3.5;

  it('states the figure the constants produce', () => {
    const expected = AVG_KG_PER_BAG * CARBON_PER_KG;
    expect(expected).toBe(5.25);
    expect(src).toContain(`metric: '${expected} kg CO₂e'`);
  });

  it('no longer states the figure that contradicted /companies', () => {
    expect(src).not.toContain('2.5 kg CO₂');
  });
});

describe('claims falsified by Omnibus I do not return', () => {
  it.each([
    ['CSDDD transposition, moved to 26 July 2028', 'Transposition by 2026'],
    ['the CSRD population, cut by roughly 90%', 'Over 50,000 EU companies'],
    ['the CSRD population, as a hero statistic', "n: '50 000+'"],
    ['the unsupported CBAM cost figure', '€50B'],
  ])('does not claim %s', (_what, phrase) => {
    expect(src).not.toContain(phrase);
  });

  it('gives CSDDD its post-Omnibus application date', () => {
    expect(src).toContain('26 July 2029');
  });

  it('states the CBAM de minimis, which exempts most smaller exporters', () => {
    expect(src).toMatch(/50-tonne annual de minimis/);
  });
});

describe('unsupported figures removed rather than reworded', () => {
  it.each([
    ['the 73% export share, which is about 70%', /73%/],
    ['an operating-cost saving range with no source', /10.20% within three years/],
    ['SFDR moving trillions by itself', /pushing trillions/],
  ])('does not carry %s', (_what, pattern) => {
    expect(src).not.toMatch(pattern);
  });
});

describe('Tailwind classes that would render nothing', () => {
  /**
   * Resolved from tailwindcss/defaultConfig, not assumed:
   * 0 5 10 15 20 25 30 35 40 45 50 55 60 65 70 75 80 85 90 95 100.
   * A modifier off that scale and not bracketed produces no CSS rule.
   */
  const OPACITY_STEP = 5;

  const modifiers = [...src.matchAll(/\b[a-z-]+-[a-zA-Z0-9-]+\/(\d+)\b/g)].map(m => ({
    cls: m[0],
    value: Number(m[1]),
  }));

  it('finds opacity modifiers to check, so this suite is not vacuous', () => {
    expect(modifiers.length).toBeGreaterThan(20);
  });

  it('uses only modifiers Tailwind will emit a rule for', () => {
    const dead = modifiers.filter(m => m.value % OPACITY_STEP !== 0).map(m => m.cls);
    expect(dead).toEqual([]);
  });
});

describe('contrast: accents stay on the ground they were measured for', () => {
  /**
   * brand-green is 5.11 on white and 4.65 on cream, and 2.08 on the dark teal -
   * invisible. secondary-light is 6.33 on the dark teal. Coral fails every
   * light surface (2.55 / 2.32) and is reserved for destructive states, of
   * which this page has none.
   */
  it('uses no coral anywhere on the page', () => {
    expect(src).not.toContain('brand-coral');
  });

  it('puts no brand-green inside the two dark-ground sections', () => {
    const darkSections = [...src.matchAll(/<section[^>]*bg-primary-500[^>]*>/g)].map(m => m.index);
    expect(darkSections.length).toBeGreaterThan(0);

    for (const start of darkSections) {
      const end = src.indexOf('</section>', start ?? 0);
      const body = src.slice(start ?? 0, end);
      expect(body).not.toContain('text-brand-green');
    }
  });

  it.each([
    ['text-primary-500/45', 2.39],
    ['text-primary-500/55', 3.03],
    ['text-primary-500/60', 3.42],
    ['text-primary-500/65', 3.92],
    ['text-white/55', 4.46],
  ])('does not use %s, which measures %s against its ground', (cls, _ratio) => {
    expect(src).not.toContain(cls);
  });
});

describe('house rules', () => {
  it('uses no raw hex values', () => {
    expect(src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).toEqual([]);
  });

  it('uses no em dash', () => {
    expect(src).not.toMatch(/—/);
  });
});
