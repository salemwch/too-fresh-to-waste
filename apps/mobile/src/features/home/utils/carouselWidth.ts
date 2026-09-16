/**
 * Card widths for the home screen's horizontal carousels.
 *
 * WHY THIS IS NOT A CONSTANT
 * --------------------------
 * It used to be: `CAROUSEL_CARD_VISIBLE_WIDTH: 320` in `homeConstants.ts`. That
 * is 82% of a 390dp phone, which is why it looked right on the emulator it was
 * tuned on. Everywhere else it is wrong, and on small phones it is broken:
 *
 *     screen    card     peek of the next card
 *     320dp     100%     none - the card is WIDER than the screen
 *     360dp      89%     8%  - too small to read as scrollable
 *     390dp      82%     15% - the value it was tuned for
 *     430dp      74%     23%
 *
 * 360dp is the most common Android width in this market, so the majority case
 * was the one showing almost no peek. A carousel whose next card is not visible
 * reads as a static banner and does not get swiped.
 *
 * WHY THE PEEK MATTERS
 * --------------------
 * It is the only affordance a horizontal list has. Material 3 calls this the
 * uncontained carousel: the trailing item is deliberately cut off by the screen
 * edge to signal that the row scrolls. Take the peek away and the row looks
 * like a single card with dead space beside it.
 *
 * The two ratios differ on purpose. Hero banners are READ - they carry an
 * amount, a progress bar and two lines of copy - so they need width. Deal cards
 * are SCANNED, so they trade width for a bigger peek and a faster browse
 * rhythm.
 */

/** Hero banners (impact, prize drop). Read, so they get width. */
export const HERO_CARD_RATIO = 0.82;

/** Offer cards in the four deal carousels. Scanned, so they get more peek. */
export const DEAL_CARD_RATIO = 0.72;

/**
 * Below this the peek is too thin to notice, above it the card stops reading as
 * "one at a time". Values outside the band are almost always a mistake rather
 * than a deliberate choice, so they are clamped rather than honoured.
 */
const MIN_RATIO = 0.6;
const MAX_RATIO = 0.9;

/** Falls back to a 390dp phone if the platform hands us nothing usable. */
const FALLBACK_SCREEN_WIDTH = 390;

export interface CarouselWidthInput {
  /** `useWindowDimensions().width`. */
  screenWidth: number;
  /** One of the ratios above. */
  ratio: number;
  /** Space between cards; the snap interval has to include it. */
  gap: number;
}

export interface CarouselWidth {
  /** Width of the card itself. */
  cardWidth: number;
  /**
   * What the list snaps by.
   *
   * MUST be `cardWidth + gap`. `snapToInterval` and `getItemLayout` both read
   * it, and if it disagrees with the rendered width by even a pixel the drift
   * compounds down the list - by the fifth card the snap lands visibly
   * off-centre. That is why both come from here rather than being written out
   * separately at each call site.
   */
  snapInterval: number;
}

const safe = (n: number, fallback: number): number => (Number.isFinite(n) && n > 0 ? n : fallback);

export const getCarouselWidth = ({
  screenWidth,
  ratio,
  gap,
}: CarouselWidthInput): CarouselWidth => {
  const width = safe(screenWidth, FALLBACK_SCREEN_WIDTH);
  const safeGap = Number.isFinite(gap) && gap >= 0 ? gap : 0;
  const clampedRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, safe(ratio, DEAL_CARD_RATIO)));

  // Rounded: fractional widths make React Native round inconsistently between
  // the card and the snap interval, which reintroduces the drift above.
  const cardWidth = Math.round(width * clampedRatio);

  return { cardWidth, snapInterval: cardWidth + safeGap };
};
