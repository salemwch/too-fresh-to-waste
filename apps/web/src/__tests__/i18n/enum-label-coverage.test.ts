import { CycleStatus, PrizeCategory } from '@foodwaste/shared';

import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import ar from '@/messages/ar.json';

/**
 * Every enum value a screen can render must have a label in every locale.
 *
 * ## The chain this closes
 *
 * Several admin screens render an enum by lowercasing it into a translation
 * key - `t(\`status.${cycle.status.toLowerCase()}\`)`. Nothing connects the
 * enum to the message file, so adding a member to `CycleStatus` compiles,
 * builds, passes every existing test, and then renders the raw key
 * `adminVoting.status.tallying` at an admin.
 *
 * That is exactly how the voting area got into its previous state: the badge
 * rendered `cycle.status.replace('_', ' ')`, which produced "BALLOT OPEN" in
 * every language and looked deliberate enough to survive review.
 *
 * `registration-chains.test.ts` already proves fr and ar carry the same keys as
 * en. What it cannot know is which keys the *enums* demand. This does.
 */

const LOCALES = { en, fr, ar } as const;

/** Reads a dotted path out of a messages object. */
function messageAt(messages: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], messages);
}

/**
 * Each row is a fixed set the UI renders, and the namespace it renders through.
 * The keys are derived from the enum, never restated - restating them would
 * reintroduce the very drift this guards.
 */
const FIXED_SETS = [
  {
    name: 'CycleStatus',
    namespace: 'adminVoting.status',
    values: Object.values(CycleStatus),
    // The screens lowercase the enum to build the key.
    toKey: (value: string) => value.toLowerCase(),
  },
  {
    name: 'PrizeCategory',
    namespace: 'adminVoting.prizes.categories',
    values: Object.values(PrizeCategory),
    toKey: (value: string) => value.toLowerCase(),
  },
] as const;

describe('enum label coverage', () => {
  it('has a non-trivial set of enums to check', () => {
    // Guards the derivation itself: if the imports resolved to empty objects,
    // every case below would pass vacuously.
    for (const set of FIXED_SETS) {
      expect(set.values.length).toBeGreaterThan(0);
    }
  });

  describe.each(FIXED_SETS)('$name', ({ namespace, values, toKey }) => {
    describe.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('%s', locale => {
      // Spread into a mutable array: `it.each` has no overload for the
      // readonly tuple that `as const` gives the table above.
      it.each([...values])('%s has a label', value => {
        const key = `${namespace}.${toKey(value)}`;
        const label = messageAt(LOCALES[locale], key);

        expect(typeof label).toBe('string');
        expect((label as string).trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe.each(FIXED_SETS)('$name has no orphaned labels', ({ namespace, values, toKey }) => {
    it('every key in the namespace maps back to an enum member', () => {
      // The other direction. A label left behind after an enum member is
      // removed is dead weight that reads as still-supported.
      const block = messageAt(en, namespace) as Record<string, unknown>;
      const expected = new Set(values.map(toKey));
      const actual = Object.keys(block);

      expect(actual.filter(k => !expected.has(k))).toEqual([]);
    });
  });

  it('keeps the three locales in agreement about which enum keys exist', () => {
    for (const { namespace } of FIXED_SETS) {
      const keysPerLocale = (Object.keys(LOCALES) as (keyof typeof LOCALES)[]).map(locale =>
        Object.keys(messageAt(LOCALES[locale], namespace) as Record<string, unknown>).sort(),
      );

      expect(keysPerLocale[1]).toEqual(keysPerLocale[0]);
      expect(keysPerLocale[2]).toEqual(keysPerLocale[0]);
    }
  });
});
