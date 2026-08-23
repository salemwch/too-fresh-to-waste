/**
 * Four numbers were live on /companies. Two of them had no source, and the
 * mechanism behind a third did not apply to the reader at all:
 *
 *  - "€50B+ CBAM compliance cost by 2030" - published estimates are an order of
 *    magnitude lower, and CBAM covers cement, steel, aluminium, fertilisers,
 *    electricity and hydrogen. Not food, not services.
 *  - "73% of employees worry about daily food costs" - no source found.
 *
 * Both are gone. The tests below exist because nothing else stops them coming
 * back: a statistic is a string in a JSON file, and a type-check has no opinion
 * about whether it is true. The `source` field is the structural fix, so its
 * absence has to fail somewhere.
 */

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

type Stat = { value: string; label: string; source: string };
type Framework = { code: string; title: string; body: string };
type Companies = {
  meta: { description: string };
  hero: { sub: string; stats: Stat[] };
  urgency: { body: string };
  frameworks: { items: Framework[] };
  employee: { bridge: string };
};

const companiesOf = (messages: unknown): Companies =>
  (messages as { companies: Companies }).companies;

/** Everything the page renders as prose or a stat, flattened for text sweeps. */
const allText = (c: Companies): string => JSON.stringify(c);

describe.each(LOCALES)('companies claims - %s', (_locale, messages) => {
  const companies = companiesOf(messages);

  describe('every hero statistic says where it came from', () => {
    it.each([0, 1, 2])('stat %i carries a non-empty source', index => {
      const stat = companies.hero.stats[index];
      expect(stat).toBeDefined();
      expect(typeof stat?.source).toBe('string');
      expect(stat?.source.trim().length).toBeGreaterThan(0);
    });

    it('renders exactly three stats, matching the three-column grid', () => {
      expect(companies.hero.stats).toHaveLength(3);
    });
  });

  describe('the retired claims cannot come back', () => {
    it('makes no CBAM claim - the mechanism does not cover food or services', () => {
      expect(allText(companies)).not.toMatch(/CBAM/i);
    });

    it('does not carry the unsourced 73% employee figure', () => {
      expect(allText(companies)).not.toMatch(/73\s*%/);
    });

    it.each([
      ['euro billions, en', /€\s*50\s*B/i],
      ['euro billions, fr', /50\s*G€/i],
      ['euro billions, ar', /50\s*مليار/],
    ])('does not carry the unsourced CBAM cost figure (%s)', (_name, pattern) => {
      expect(allText(companies)).not.toMatch(pattern);
    });
  });

  describe('the bridge into the employee section', () => {
    it('exists, so the section is not entered with an unexplained change of register', () => {
      expect(companies.employee.bridge.trim().length).toBeGreaterThan(0);
    });

    it('makes its case without a percentage, since the sourced one did not exist', () => {
      expect(companies.employee.bridge).not.toMatch(/\d\s*%/);
    });
  });

  describe('values the animated Counter has to parse', () => {
    /**
     * Counter does `parseFloat(value.replace(/[^0-9.]/g, ''))` and then loops
     * until `start >= numeric`. A value with no digit yields NaN, that
     * comparison is never true, and the interval runs forever behind a stat
     * that reads "NaN".
     */
    it.each([0, 1, 2])('stat %i contains a digit', index => {
      const value = companies.hero.stats[index]?.value ?? '';
      expect(value).toMatch(/[0-9]/);
      expect(Number.isNaN(parseFloat(value.replace(/[^0-9.]/g, '')))).toBe(false);
    });
  });

  it('uses no em dash, per the house rule', () => {
    expect(allText(companies)).not.toMatch(/\u2014/);
  });
});

describe('locale parity', () => {
  const [, base] = LOCALES[0];
  const baseCompanies = companiesOf(base);

  it.each(LOCALES.slice(1))(
    '%s renders the same number of framework cards as en',
    (_locale, messages) => {
      expect(companiesOf(messages).frameworks.items).toHaveLength(
        baseCompanies.frameworks.items.length,
      );
    },
  );

  it.each(LOCALES)('%s keeps the framework codes aligned with en', (_locale, messages) => {
    expect(companiesOf(messages).frameworks.items.map(i => i.code)).toEqual(
      baseCompanies.frameworks.items.map(i => i.code),
    );
  });
});
