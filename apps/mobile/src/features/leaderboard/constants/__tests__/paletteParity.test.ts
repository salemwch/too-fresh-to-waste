/**
 * Palette parity.
 *
 * The leaderboard palette was converted from hand-written rgba strings to
 * withAlpha() over design tokens. That refactor is only correct if it changed
 * nothing on screen, and a colour shift is invisible in a diff and invisible in
 * every other test.
 *
 * These are the literal pre-conversion values, transcribed from the commit that
 * introduced them. Whitespace is normalised because withAlpha emits
 *  while the originals were written unspaced.
 */
/**
 * Palette parity.
 *
 * The leaderboard palette was converted from hand-written rgba strings to
 * withAlpha() over design tokens. That refactor is only correct if it changed
 * nothing on screen — and a colour shift is invisible in a diff, invisible in
 * every other test, and only shows up on a device.
 *
 * These are the literal pre-conversion values, transcribed from the commits
 * that introduced them. Whitespace is normalised because withAlpha emits
 * spaced rgba while the originals were written unspaced.
 */

import * as p from '@/features/leaderboard/constants/palette';

const ORIGINAL: Record<string, string> = {
  GOLD_15: 'rgba(196,162,90,0.15)',
  GOLD_10: 'rgba(196,162,90,0.1)',
  GOLD_06: 'rgba(196,162,90,0.06)',
  GOLD_04: 'rgba(196,162,90,0.04)',
  GOLD_35: 'rgba(196,162,90,0.35)',
  GOLD_60: 'rgba(196,162,90,0.6)',
  GOLD_80: 'rgba(196,162,90,0.8)',
  BG_CARD: 'rgba(255,255,255,0.02)',
  BG_CARD_TOP5: 'rgba(196,162,90,0.02)',
  BORDER_CARD: 'rgba(255,255,255,0.035)',
  BORDER_CARD_TOP5: 'rgba(196,162,90,0.06)',
  BORDER_GOLD: 'rgba(196,162,90,0.3)',
  WHITE_04: 'rgba(255,255,255,0.04)',
  WHITE_08: 'rgba(255,255,255,0.08)',
  WHITE_10: 'rgba(255,255,255,0.1)',
  TEXT_WHITE: '#ffffff',
  TEXT_85: 'rgba(255,255,255,0.85)',
  TEXT_60: 'rgba(255,255,255,0.6)',
  TEXT_40: 'rgba(255,255,255,0.4)',
  TEXT_30: 'rgba(255,255,255,0.3)',
  TEXT_25: 'rgba(255,255,255,0.25)',
  OVERLAY: 'rgba(0,0,0,0.45)',
  SURFACE: '#FFFFFF',
  // Moved out of the components in the same commit; same values.
  COUNTDOWN_SEGMENT_BG: 'rgba(0,0,0,0.4)',
  COUNTDOWN_SEGMENT_BORDER: 'rgba(196,162,90,0.12)',
  COUNTDOWN_SEPARATOR: 'rgba(196,162,90,0.25)',
  WHITE_05: 'rgba(255,255,255,0.05)',
  HANDLE_GREY: '#E8EEEF',
  DISCOUNT_TINT: '#F0FDF4',
};
const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();

describe('palette parity with the pre-token values', () => {
  it.each(Object.entries(ORIGINAL))('%s is unchanged', (key, original) => {
    expect(norm((p as unknown as Record<string, string>)[key]!)).toBe(norm(original));
  });
});
