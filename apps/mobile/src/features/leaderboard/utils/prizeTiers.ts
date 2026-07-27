/**
 * Which prize a leaderboard rank qualifies for.
 *
 * The cutoff drives row styling as well as the claim flow, so it lives in one
 * place rather than as a bare `rank <= 5` in whichever component needs it.
 */

/**
 * Ranks 1..3 win a phone; everyone below wins a discount.
 *
 * Must match `PHONE_MAX_RANK` in the backend's `prize-claim.service.ts` — the
 * server decides what is actually awarded, this only decides what is shown.
 */
export const PHONE_PRIZE_MAX_RANK = 3;

/** The first rank that wins a discount rather than a phone. */
export const DISCOUNT_PRIZE_MIN_RANK = PHONE_PRIZE_MAX_RANK + 1;

export type RowTier = 'phone' | 'discount';

/**
 * @param targetReached whether the community bag goal was met. When it was not,
 * no smartphone is unlocked and every rank falls back to the discount — so the
 * row styling must not keep promising a phone to the top 3.
 */
export function getRowTier(rank: number, targetReached = true): RowTier {
  return targetReached && rank <= PHONE_PRIZE_MAX_RANK ? 'phone' : 'discount';
}
