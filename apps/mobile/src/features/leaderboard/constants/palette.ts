/**
 * Leaderboard palette — dark premium theme.
 *
 * The leaderboard deliberately ignores the app's light/dark theme and always
 * renders on a dark gold-accented surface, so these are fixed values rather
 * than theme lookups.
 *
 * Derived from tokens wherever a token exists: the white and black tints are
 * `withAlpha` over the neutral scale, so they follow the token rather than
 * being twenty independent copies of `rgba(255,255,255,…)`.
 *
 * CHAMPION_GOLD has no token because nothing else in the app uses it — it is
 * this screen's accent, and it stays here until a second consumer justifies
 * promoting it.
 */

import { colorTokens, withAlpha } from '@/design-system/tokens/colors';

const { neutral } = colorTokens.base;

export const PRIMARY = colorTokens.base.primary[500];

// ── Gold accent ──
export const CHAMPION_GOLD = '#c4a25a';

export const GOLD_04 = withAlpha(CHAMPION_GOLD, 0.04);
export const GOLD_06 = withAlpha(CHAMPION_GOLD, 0.06);
export const GOLD_10 = withAlpha(CHAMPION_GOLD, 0.1);
export const GOLD_15 = withAlpha(CHAMPION_GOLD, 0.15);
/** Podium: medal ring, champion points, top-5 points. */
export const GOLD_35 = withAlpha(CHAMPION_GOLD, 0.35);
export const GOLD_60 = withAlpha(CHAMPION_GOLD, 0.6);
export const GOLD_80 = withAlpha(CHAMPION_GOLD, 0.8);

/** Countdown segments sit on a darkened well with a faint gold edge. */
export const COUNTDOWN_SEGMENT_BG = withAlpha(neutral[1000], 0.4);
export const COUNTDOWN_SEGMENT_BORDER = withAlpha(CHAMPION_GOLD, 0.12);
export const COUNTDOWN_SEPARATOR = withAlpha(CHAMPION_GOLD, 0.25);

// ── Surfaces ──
export const BG_DARK = '#0a1e20';
export const BG_CARD = withAlpha(neutral[0], 0.02);
export const BG_CARD_TOP5 = withAlpha(CHAMPION_GOLD, 0.02);
export const BORDER_CARD = withAlpha(neutral[0], 0.035);
export const BORDER_CARD_TOP5 = withAlpha(CHAMPION_GOLD, 0.06);
export const BORDER_GOLD = withAlpha(CHAMPION_GOLD, 0.3);
export const WHITE_04 = withAlpha(neutral[0], 0.04);
export const WHITE_08 = withAlpha(neutral[0], 0.08);
export const WHITE_10 = withAlpha(neutral[0], 0.1);
/** Header info button — lighter than the card tints so it reads as tappable. */
export const WHITE_05 = withAlpha(neutral[0], 0.05);

// ── Text on dark ──
export const TEXT_WHITE = neutral[0];
export const TEXT_85 = withAlpha(neutral[0], 0.85);
export const TEXT_60 = withAlpha(neutral[0], 0.6);
export const TEXT_40 = withAlpha(neutral[0], 0.4);
export const TEXT_30 = withAlpha(neutral[0], 0.3);
export const TEXT_25 = withAlpha(neutral[0], 0.25);

// ── Prize modal: keeps a light surface for readability ──
export const OVERLAY = withAlpha(neutral[1000], 0.45);
export const SURFACE = neutral[0];
export const BORDER_SUBTLE = '#F3F4F6';
/** Sheet grab handle. */
export const HANDLE_GREY = '#E8EEEF';
/** Discount tier chip — a green tint with no counterpart in the token scale. */
export const DISCOUNT_TINT = '#F0FDF4';
export const TEXT_PRIMARY = '#0F2628';
export const TEXT_SECONDARY = '#4B6264';
export const TEXT_TERTIARY = '#8FA6A9';
