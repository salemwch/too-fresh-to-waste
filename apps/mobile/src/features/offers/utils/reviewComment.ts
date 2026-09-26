/**
 * The comment attached to a one-tap review.
 *
 * The backend requires a 10-2000 character `comment` (CreateReviewDto), but the
 * review sheet only asks for stars and optional highlights. So the comment is
 * composed from those two answers, in the reviewer's own language - it is their
 * review, and the merchant reads it as written.
 *
 * It used to be English whatever the app language, and it said "Really enjoyed
 * this surprise bag" whenever a highlight was ticked - including on a one-star
 * review. The sentence now follows the rating, and the highlights are listed as
 * what the reviewer liked.
 */

import type { Translate } from '@/i18n/translate';

/** Detailed-rating keys the backend accepts, in the order the chips show. */
export const REVIEW_HIGHLIGHT_KEYS = [
  'foodQuality',
  'valueForMoney',
  'serviceQuality',
  'packaging',
  'pickupExperience',
  'sustainability',
] as const;

export type ReviewHighlightKey = (typeof REVIEW_HIGHLIGHT_KEYS)[number];

/** Literal keys, so a grep for any of them finds its call site. */
export const HIGHLIGHT_LABEL_KEYS: Readonly<Record<ReviewHighlightKey, string>> = Object.freeze({
  foodQuality: 'reviews.highlights.foodQuality',
  valueForMoney: 'reviews.highlights.valueForMoney',
  serviceQuality: 'reviews.highlights.serviceQuality',
  packaging: 'reviews.highlights.packaging',
  pickupExperience: 'reviews.highlights.pickupExperience',
  sustainability: 'reviews.highlights.sustainability',
});

export const isReviewHighlightKey = (key: string): key is ReviewHighlightKey =>
  Object.prototype.hasOwnProperty.call(HIGHLIGHT_LABEL_KEYS, key);

/** "a", "a and b", "a, b and c" - separators come from the locale. */
export function joinHighlights(labels: readonly string[], t: Translate): string {
  if (labels.length <= 1) return labels[0] ?? '';
  const head = labels.slice(0, -1).join(t('reviews.listSeparator', {}));
  const last = labels[labels.length - 1] ?? '';
  return t('reviews.listAnd', { head, last });
}

type Tone = 'great' | 'okay' | 'poor';

const toneFor = (rating: number): Tone => {
  if (rating >= 4) return 'great';
  if (rating === 3) return 'okay';
  return 'poor';
};

const PLAIN_KEYS: Readonly<Record<Tone, string>> = Object.freeze({
  great: 'reviews.commentGreat',
  okay: 'reviews.commentOkay',
  poor: 'reviews.commentPoor',
});

const WITH_HIGHLIGHTS_KEYS: Readonly<Record<Tone, string>> = Object.freeze({
  great: 'reviews.commentGreatWith',
  okay: 'reviews.commentOkayWith',
  poor: 'reviews.commentPoorWith',
});

export function buildReviewComment(
  rating: number,
  highlights: readonly ReviewHighlightKey[],
  t: Translate,
): string {
  const tone = toneFor(rating);
  if (highlights.length === 0) return t(PLAIN_KEYS[tone], {});

  const labels = highlights.map(key => t(HIGHLIGHT_LABEL_KEYS[key], {}));
  return t(WITH_HIGHLIGHTS_KEYS[tone], { highlights: joinHighlights(labels, t) });
}
