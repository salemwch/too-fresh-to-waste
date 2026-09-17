/**
 * Shared geometry for the two hero banners in the home carousel.
 *
 * WHY A CONSTANT AND NOT `minHeight` ON EACH CARD
 * -----------------------------------------------
 * The impact card and the prize card sit side by side in a horizontal
 * FlatList. A horizontal list does not stretch its rows to the tallest one, so
 * with `minHeight` each card is exactly as tall as its own copy - and the copy
 * differs per locale, per amount and per season name. In French the impact
 * card's title wraps to two lines and its amount line to two more, so it grew
 * ~20dp past the prize card and the pair read as a rendering defect while the
 * user swiped between them.
 *
 * A fixed height makes the pair equal by construction rather than by luck.
 * The cost is that every text run inside a hero card MUST be capped with
 * `numberOfLines`, or long copy overflows the box instead of growing it.
 *
 * WHERE THE NUMBER COMES FROM
 * ---------------------------
 * It is the taller of the two content stacks plus the card's own padding,
 * not a value picked to look right:
 *
 *     impact  title 2 x 20 + 4 + amount 18 + 2 + contributors 17 = 81
 *     prize   title 22 + 6 + count 18 + 6 + bar 6 + 6 + remaining 17 = 81
 *     padding sp.md top + sp.md bottom                              = 32
 *                                                                   ----
 *                                                                    113
 *
 * rounded up to 116 so neither stack sits flush against the padding.
 */

import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/** Inner padding of a hero card. Both cards, so the content budget is shared. */
export const HERO_CARD_PADDING = sp.md;

/** Vertical breathing room OUTSIDE the card, inside the carousel row. */
export const HERO_CARD_OUTER_PADDING_Y = sp.xs;

/**
 * Height of both hero cards, and of the skeletons that stand in for them.
 *
 * Changing this means re-checking the line budget above: the cards cap their
 * text, so extra height shows as empty space and less height clips.
 */
export const HERO_CARD_HEIGHT = 116;

/** Corner radius shared by both cards and both skeletons. */
export const HERO_CARD_RADIUS = 16;

/** Illustration box. Narrow on purpose - the text column is the scarce one. */
export const HERO_CARD_ILLUSTRATION_WIDTH = 72;
export const HERO_CARD_ILLUSTRATION_HEIGHT = 56;
