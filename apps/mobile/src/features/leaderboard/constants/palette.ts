/**
 * Leaderboard palette — light premium theme.
 *
 * The leaderboard deliberately ignores the app's light/dark theme and always
 * renders on one fixed surface, so these are literal values rather than theme
 * lookups. That surface used to be dark; it is a warm cream ground as of the
 * 2026-09-02 redesign, with the dark teal reserved for the two cards that
 * should read as premium — the Grand Prize hero and the closing banner.
 *
 * Derived from tokens wherever a token exists: the tints are `withAlpha` over
 * the neutral and primary scales, so they follow the token rather than being
 * twenty independent copies of `rgba(...)`.
 *
 * The warm neutrals below have no token, for the same reason CHAMPION_GOLD has
 * none: nothing else in the app uses them. They are this screen's ground, and
 * they stay here until a second consumer justifies promoting them into
 * `design-system/tokens/colors.ts`. Adding four global tokens to serve one
 * screen would inflate the palette for no reuse.
 */

import { colorTokens, withAlpha } from '@/design-system/tokens/colors';

const { neutral, primary, success } = colorTokens.base;

export const PRIMARY = primary[500];

// ── Gold accent ──
export const CHAMPION_GOLD = '#c4a25a';

export const GOLD_06 = withAlpha(CHAMPION_GOLD, 0.06);
export const GOLD_10 = withAlpha(CHAMPION_GOLD, 0.1);
export const GOLD_15 = withAlpha(CHAMPION_GOLD, 0.15);
export const GOLD_45 = withAlpha(CHAMPION_GOLD, 0.45);
/** Gold dark enough to pass AA as text on the cream ground (5.1:1). */
export const GOLD_INK = '#9A7B36';

// ── Podium metals, shared by the podium and the ranking rows ──
// The list repeats the podium's own metals so the two agree at a glance; a
// single source here is what stops them drifting apart.
export const SILVER = '#A8B3B5';
export const BRONZE = '#C08552';
export const SILVER_TINT = '#F4F6F6';
export const BRONZE_TINT = '#FBF2E8';
export const SILVER_BORDER = withAlpha(SILVER, 0.45);
export const BRONZE_BORDER = withAlpha(BRONZE, 0.38);

// ── Surfaces (no token: screen-local, see file header) ──
/** Screen ground. */
export const BG_CREAM = '#FAF7F0';
/** Grand-prize tier card and the rank-1 row. */
export const BG_GOLD_CARD = '#FDF7E9';
/** Discount tier card. */
export const BG_MINT_CARD = '#EAF5EE';
/** Podium blocks. */
export const BG_PODIUM = '#F3ECDD';
/** Podium block under the champion — a step darker so first place reads first. */
export const BG_PODIUM_FIRST = '#EFE6D3';

// ── Cards on the cream ground ──
export const SURFACE = neutral[0];
export const BORDER_CARD_LIGHT = withAlpha(primary[500], 0.08);
export const BORDER_MINT = withAlpha(success[500], 0.16);
export const BORDER_SUBTLE = neutral[100];
/** Hairline for the rule that separates the winning band from the rest. */
export const DIVIDER = '#E4E7E7';

// ── The two dark cards ──
export const BG_DARK = '#0a1e20';
export const HERO_FROM = '#20494B';
export const HERO_TO = '#173A3C';

// ── Text on the dark cards ──
export const TEXT_WHITE = neutral[0];
export const TEXT_85 = withAlpha(neutral[0], 0.85);
export const TEXT_40 = withAlpha(neutral[0], 0.4);
export const TEXT_30 = withAlpha(neutral[0], 0.3);
export const TEXT_25 = withAlpha(neutral[0], 0.25);
/** Hero subtitle: the mint that reads as "in progress" on the dark ground. */
export const MINT = success[300];

// ── Text on the cream ground ──
export const TEXT_PRIMARY = '#0F2628';
export const TEXT_SECONDARY = '#4B6264';
export const TEXT_TERTIARY = '#8FA6A9';
export const TEXT_MUTED = neutral[600];
export const DISCOUNT_INK = success[500];

// ── Countdown ──
// Unchanged: the countdown moved from the dark screen onto the dark hero card,
// so its ground is the same tone it was tuned against and the values still hold.
export const COUNTDOWN_SEGMENT_BG = withAlpha(neutral[1000], 0.4);
export const COUNTDOWN_SEGMENT_BORDER = withAlpha(CHAMPION_GOLD, 0.12);
export const COUNTDOWN_SEPARATOR = withAlpha(CHAMPION_GOLD, 0.25);

// ── Modals: light surface, unchanged ──
export const OVERLAY = withAlpha(neutral[1000], 0.45);
/** Sheet grab handle. */
export const HANDLE_GREY = '#E8EEEF';
/** Discount tier chip — a green tint with no counterpart in the token scale. */
export const DISCOUNT_TINT = '#F0FDF4';
