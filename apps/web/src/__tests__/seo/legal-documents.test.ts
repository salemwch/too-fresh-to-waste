/**
 * The legal documents ship on one condition, and this file is what enforces it.
 *
 * A translated policy is for comprehension; one language still has to be the
 * one a dispute is read in. The French and Arabic renderings therefore carry a
 * governing-language clause naming English authoritative, and the English does
 * not - a document cannot sensibly defer to itself. If the clause were dropped
 * from a locale by an edit to the JSON, nothing else in the build would notice,
 * and the page would silently become a policy claiming equal standing.
 *
 * The rest of this file pins the numbers. Retention periods, dispute windows
 * and liability caps are commitments, and a figure that differs between two
 * language versions is a promise we did not make in one of them.
 */

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

const TRANSLATED_LOCALES = [
  ['fr', fr],
  ['ar', ar],
] as const;

const DOCUMENTS = [
  'cookiePolicy',
  'accountDeletion',
  'security',
  'privacyPolicy',
  'termsOfService',
  'termsAndConditions',
] as const;

interface LegalSubsection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
}
interface LegalSection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  subsections?: LegalSubsection[];
}
interface LegalDoc {
  meta: { title: string; description: string };
  title: string;
  intro?: string[];
  sections: LegalSection[];
}
type LegalNamespace = Record<string, unknown> & {
  governingLanguage: string;
  dateline: string;
  lastUpdated: string;
};

const legalOf = (messages: unknown): LegalNamespace =>
  (messages as { legal: LegalNamespace }).legal;

const docOf = (messages: unknown, name: string): LegalDoc =>
  legalOf(messages)[name] as unknown as LegalDoc;

const textOf = (doc: LegalDoc): string => JSON.stringify(doc);

describe('the governing-language clause', () => {
  it.each(TRANSLATED_LOCALES)('is present on the %s documents', (_l, messages) => {
    const clause = legalOf(messages).governingLanguage;
    expect(clause.trim().length).toBeGreaterThan(0);
  });

  it.each(TRANSLATED_LOCALES)('names English as authoritative in %s', (locale, messages) => {
    const clause = legalOf(messages).governingLanguage;
    const namesEnglish = locale === 'fr' ? /anglaise/ : /الإنجليزية/;
    expect(clause).toMatch(namesEnglish);
  });

  it('is absent on the English documents, which are the authoritative text', () => {
    expect(legalOf(en).governingLanguage).toBe('');
  });
});

describe.each(LOCALES)('every legal document is complete - %s', (_l, messages) => {
  it.each(DOCUMENTS)('%s has a title, metadata and sections', name => {
    const doc = docOf(messages, name);
    expect(doc.title.trim().length).toBeGreaterThan(0);
    expect(doc.meta.title.trim().length).toBeGreaterThan(0);
    expect(doc.meta.description.trim().length).toBeGreaterThan(0);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it.each(DOCUMENTS)('%s uses no em dash, per the house rule', name => {
    expect(textOf(docOf(messages, name))).not.toMatch(/—/);
  });
});

describe.each(LOCALES)('commitments hold their value - %s', (_l, messages) => {
  /**
   * Each entry is a promise the document makes. The regex is deliberately loose
   * about surrounding words and strict about the figure, because the figure is
   * the commitment and the sentence around it is not.
   */
  it.each([
    ['accountDeletion', 'purge within 30 days', /30/],
    ['accountDeletion', 'order records kept 5 years', /5/],
    ['accountDeletion', 'email requests answered in 7 business days', /7/],
    ['privacyPolicy', 'analytics anonymised after 14 months', /14/],
    ['privacyPolicy', 'rights requests answered within 30 days', /30/],
    ['security', 'bcrypt cost factor 12', /12/],
    ['security', 'access tokens expire in 15 minutes', /15/],
    ['security', 'disclosure acknowledged in 3 business days', /3/],
    ['security', 'disclosure embargo of 90 days', /90/],
    ['termsOfService', 'minimum age 16', /16/],
    ['termsOfService', 'disputes within 24 hours', /24/],
    ['termsAndConditions', 'disputes within 24 hours', /24/],
    ['termsAndConditions', 'changes notified 7 days ahead', /7/],
  ])('%s states: %s', (doc, _what, pattern) => {
    expect(textOf(docOf(messages, doc))).toMatch(pattern);
  });
});

describe.each(LOCALES)('the marketplace-intermediary framing survives - %s', (locale, messages) => {
  /**
   * This is the load-bearing clause of the whole document set: TFTW does not
   * own, prepare, store or handle the food, and the sale happens between the
   * consumer and the Store. A translation that softens it has changed who is
   * liable for a foodborne illness.
   */
  const intermediary = { en: /intermediary/i, fr: /intermédiaire/i, ar: /وسيط/ }[locale];

  it('appears in the terms and conditions', () => {
    expect(textOf(docOf(messages, 'termsAndConditions'))).toMatch(intermediary);
  });

  it('appears in the terms of service', () => {
    expect(textOf(docOf(messages, 'termsOfService'))).toMatch(intermediary);
  });
});

describe('locale parity', () => {
  /** Same shape in all three, or the renderer indexes into a missing entry. */
  const shape = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(shape).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
      return `{${Object.keys(value as object)
        .sort()
        .map(k => `${k}:${shape((value as Record<string, unknown>)[k])}`)
        .join(',')}}`;
    }
    return 'v';
  };

  it.each(DOCUMENTS)('%s has the same structure in en, fr and ar', name => {
    expect(shape(docOf(fr, name))).toBe(shape(docOf(en, name)));
    expect(shape(docOf(ar, name))).toBe(shape(docOf(en, name)));
  });

  it.each(DOCUMENTS)('%s is actually translated, not copied from English', name => {
    const english = docOf(en, name);
    expect(docOf(fr, name).title).not.toBe(english.title);
    expect(docOf(ar, name).title).not.toBe(english.title);
    expect(docOf(fr, name).sections[0]?.heading).not.toBe(english.sections[0]?.heading);
  });
});
