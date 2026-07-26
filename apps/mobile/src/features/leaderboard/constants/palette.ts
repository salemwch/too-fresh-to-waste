/**
 * Leaderboard palette — dark premium theme.
 *
 * The leaderboard deliberately ignores the app's light/dark theme and always
 * renders on a dark gold-accented surface, so these are fixed values rather
 * than theme lookups.
 *
 * ⚠️ Raw hex/rgba, moved verbatim out of LeaderboardScreen. They are not design
 * tokens and several are near-duplicates of each other (five gold alphas, six
 * white alphas). Converting them to tokens is tracked as its own task — they are
 * centralised here first so that conversion is one file rather than a hunt
 * through the screen and every component extracted from it.
 */

import { colorTokens } from '@/design-system/tokens/colors';

export const PRIMARY = colorTokens.base.primary[500];

// ── Gold accent ──
export const CHAMPION_GOLD = '#c4a25a';
export const GOLD_15 = 'rgba(196,162,90,0.15)';
export const GOLD_10 = 'rgba(196,162,90,0.1)';
export const GOLD_06 = 'rgba(196,162,90,0.06)';
export const GOLD_04 = 'rgba(196,162,90,0.04)';
/** Podium: champion ring, medal ring, and the plain #4/#5 ring. */
export const GOLD_35 = 'rgba(196,162,90,0.35)';
export const GOLD_60 = 'rgba(196,162,90,0.6)';
export const GOLD_80 = 'rgba(196,162,90,0.8)';

// ── Surfaces ──
export const BG_DARK = '#0a1e20';
export const BG_CARD = 'rgba(255,255,255,0.02)';
export const BG_CARD_TOP5 = 'rgba(196,162,90,0.02)';
export const BORDER_CARD = 'rgba(255,255,255,0.035)';
export const BORDER_CARD_TOP5 = 'rgba(196,162,90,0.06)';
export const BORDER_GOLD = 'rgba(196,162,90,0.3)';
export const WHITE_08 = 'rgba(255,255,255,0.08)';
export const WHITE_10 = 'rgba(255,255,255,0.1)';
export const WHITE_04 = 'rgba(255,255,255,0.04)';

// ── Text on dark ──
export const TEXT_WHITE = '#ffffff';
export const TEXT_85 = 'rgba(255,255,255,0.85)';
export const TEXT_60 = 'rgba(255,255,255,0.6)';
export const TEXT_40 = 'rgba(255,255,255,0.4)';
export const TEXT_30 = 'rgba(255,255,255,0.3)';
export const TEXT_25 = 'rgba(255,255,255,0.25)';

// ── Prize modal: keeps a light surface for readability ──
export const OVERLAY = 'rgba(0,0,0,0.45)';
export const SURFACE = '#FFFFFF';
export const BORDER_SUBTLE = '#F3F4F6';
export const TEXT_PRIMARY = '#0F2628';
export const TEXT_SECONDARY = '#4B6264';
export const TEXT_TERTIARY = '#8FA6A9';
