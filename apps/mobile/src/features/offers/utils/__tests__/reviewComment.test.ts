/**
 * buildReviewComment - the text stored as the review's `comment`.
 *
 * The backend rejects a comment shorter than 10 characters, so every branch is
 * checked against that floor, in every locale, not only the happy one.
 */

import i18next from 'i18next';

import ar from '../../../../i18n/locales/ar.json';
import en from '../../../../i18n/locales/en.json';
import fr from '../../../../i18n/locales/fr.json';
import {
  REVIEW_HIGHLIGHT_KEYS,
  buildReviewComment,
  isReviewHighlightKey,
  joinHighlights,
} from '../reviewComment';

const MIN_COMMENT = 10; // CreateReviewDto @Length(10, 2000)

const tIn = (lng: string) => (key: string, options: Record<string, string | number>) =>
  i18next.t(key, { ...options, lng });

beforeAll(async () => {
  // The jest setup loads English only; add the other two so a key missing from
  // fr or ar renders as its raw path and fails the assertions below.
  i18next.addResourceBundle('fr', 'translation', fr, true, true);
  i18next.addResourceBundle('ar', 'translation', ar, true, true);
  await Promise.resolve();
});

const t = tIn('en');

describe('buildReviewComment', () => {
  it('follows the rating when nothing is highlighted', () => {
    expect(buildReviewComment(5, [], t)).toBe(en.reviews.commentGreat);
    expect(buildReviewComment(4, [], t)).toBe(en.reviews.commentGreat);
    expect(buildReviewComment(3, [], t)).toBe(en.reviews.commentOkay);
    expect(buildReviewComment(2, [], t)).toBe(en.reviews.commentPoor);
    expect(buildReviewComment(1, [], t)).toBe(en.reviews.commentPoor);
  });

  it('does not call a one-star bag enjoyable because a highlight was ticked', () => {
    const comment = buildReviewComment(1, ['packaging'], t);
    expect(comment).not.toMatch(/enjoy/i);
    expect(comment).toContain(en.reviews.highlights.packaging);
  });

  it('lists every highlight in the order given', () => {
    const comment = buildReviewComment(5, ['foodQuality', 'valueForMoney', 'packaging'], t);
    expect(comment).toContain('Delicious food, Great value and Well packaged');
  });

  describe.each(['en', 'fr', 'ar'])('%s', lng => {
    const tl = tIn(lng);
    const cases: Array<[number, readonly (typeof REVIEW_HIGHLIGHT_KEYS)[number][]]> = [
      [5, []],
      [3, []],
      [1, []],
      [5, ['foodQuality']],
      [3, ['valueForMoney', 'sustainability']],
      [1, REVIEW_HIGHLIGHT_KEYS],
    ];

    it.each(cases)('rating %i with %j meets the backend length floor', (rating, keys) => {
      const comment = buildReviewComment(rating, keys, tl);
      expect(comment.length).toBeGreaterThanOrEqual(MIN_COMMENT);
      // A raw key path means the translation is missing in this locale.
      expect(comment).not.toMatch(/reviews\./);
    });
  });
});

describe('joinHighlights', () => {
  it('returns an empty string for no labels', () => {
    expect(joinHighlights([], t)).toBe('');
  });

  it('returns a single label unchanged', () => {
    expect(joinHighlights(['A'], t)).toBe('A');
  });

  it('joins two with the locale conjunction only', () => {
    expect(joinHighlights(['A', 'B'], t)).toBe('A and B');
    expect(joinHighlights(['A', 'B'], tIn('fr'))).toBe('A et B');
  });
});

describe('isReviewHighlightKey', () => {
  it('accepts every chip key and rejects anything else', () => {
    for (const key of REVIEW_HIGHLIGHT_KEYS) expect(isReviewHighlightKey(key)).toBe(true);
    expect(isReviewHighlightKey('overall')).toBe(false);
    expect(isReviewHighlightKey('toString')).toBe(false);
  });
});
