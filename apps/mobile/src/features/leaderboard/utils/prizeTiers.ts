/**
 * Which prize a leaderboard rank qualifies for.
 *
 * The cutoff drives row styling as well as the claim flow, so it lives in one
 * place rather than as a bare `rank <= 5` in whichever component needs it.
 */

/** Ranks 1..5 win a phone; everyone below wins a discount. */
export const PHONE_PRIZE_MAX_RANK = 5;

export type RowTier = 'phone' | 'discount';

export function getRowTier(rank: number): RowTier {
  return rank <= PHONE_PRIZE_MAX_RANK ? 'phone' : 'discount';
}
