/**
 * The homepage pass removed layers and moved content between sections. Three of
 * those changes can silently regress, and none of them would fail a type-check:
 *
 *  - `Section4` renders one card per `slides.stepN` key. A card without copy is
 *    an empty slide; copy without a card is content that never renders.
 *  - Copy deleted from one locale but not the others leaves a raw key on screen
 *    for that locale only.
 *  - The layers removed from the hero and Section 2 can be reintroduced by
 *    anyone editing the JSON, because nothing in the build objects to an unused
 *    key reappearing.
 */

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

/** Kept in step with STEP_CARDS in Section4.tsx. */
const STEP_COUNT = 3;

const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

type Messages = {
  hero: Record<string, unknown>;
  section2: Record<string, unknown>;
  section3: { benefits: Record<string, Record<string, string>> };
  section4: { slides: Record<string, { title: string; description: string }> };
  section5: Record<string, unknown>;
  audienceSplit: Record<string, unknown>;
  rewards: Record<string, unknown>;
};

const as = (m: unknown) => m as Messages;

describe.each(LOCALES)('homepage copy - %s', (_locale, messages) => {
  const m = as(messages);

  it('has exactly one step of copy per step card', () => {
    expect(Object.keys(m.section4.slides)).toHaveLength(STEP_COUNT);
  });

  it('gives every step both a title and a description', () => {
    for (const step of Object.values(m.section4.slides)) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('no longer carries the layers that were removed', () => {
    // The Section 2 subtitle restated its own title, and the FAQ's second title
    // was a second h2 inside one section.
    expect(m.section2['subtitle']).toBeUndefined();
    expect(m.section5['mainTitle']).toBeUndefined();
  });

  it('carries the copy for both new sections', () => {
    for (const key of ['title', 'description', 'merchant', 'consumer']) {
      expect(m.audienceSplit[key]).toBeDefined();
    }
    for (const key of ['eyebrow', 'title', 'description', 'points', 'families', 'prize']) {
      expect(m.rewards[key]).toBeDefined();
    }
  });

  it('keeps the hero to headline, supporting text and proof points', () => {
    // The slogan key survives - it is the company slogan and belongs somewhere -
    // but the hero must not grow a fourth text layer again.
    expect(m.hero['headline']).toBeDefined();
    expect(m.hero['subheadline']).toBeDefined();
    expect(m.hero['trust']).toBeDefined();
  });
});

describe('homepage copy across locales', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  it.each(['section2', 'section3', 'section4', 'section5', 'audienceSplit', 'rewards'])(
    '%s has an identical key set in every locale',
    namespace => {
      const [enKeys, frKeys, arKeys] = [en, fr, ar].map(m =>
        flatten((m as Record<string, unknown>)[namespace]).sort(),
      );

      expect(enKeys.length).toBeGreaterThan(0);
      expect(frKeys).toEqual(enKeys);
      expect(arKeys).toEqual(enKeys);
    },
  );

  it('leaves no benefit heading ending in a dangling preposition', () => {
    // "GET REWARDS BY REDEEM YOUR POINT" shipped in the largest type on its
    // section. A grammar checker is out of scope, but the specific shape that
    // broke - a preposition followed by a bare verb - is worth pinning.
    // Each benefit is now a { chip, title, body } object rather than a bare
    // string, so walk to the string leaves. Reading `Object.values` one level
    // deep would hand `toMatch` an object and throw rather than assert.
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'object' && value !== null
          ? Object.values(value).flatMap(strings)
          : [];

    for (const [, messages] of LOCALES) {
      const leaves = strings(as(messages).section3.benefits);
      expect(leaves.length).toBeGreaterThan(0);
      for (const value of leaves) {
        expect(value).not.toMatch(/\b(by|to|for)\s+(redeem|get|earn)\b/i);
      }
    }
  });
});
