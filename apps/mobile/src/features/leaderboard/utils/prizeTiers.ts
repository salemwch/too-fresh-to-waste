/**
 * Which prize a leaderboard rank qualifies for.
 *
 * The cutoff is **not** a constant here. How many top ranks win is
 * `VotingCycle.recipientCount`, set by the admin per season and returned on the
 * claim status. Hardcoding it meant the leaderboard drew the line at 3 while
 * the voting path awarded 5, so ranks 4 and 5 were told they had won by one
 * screen and refused by the other.
 */

/** Used only until the season's real cutoff has loaded. */
export const DEFAULT_PRIZE_RANKS = 3;

export type RowTier = 'grandPrize' | 'discount';

/**
 * @param rank the user's leaderboard position
 * @param recipientCount how many top ranks win the grand prize this season
 * @param targetReached whether the community bag goal was met. When it was not,
 * no grand prize is unlocked and every rank falls back to the discount — so the
 * tier cards must not keep promising one.
 */
export function getRowTier(
  rank: number,
  recipientCount: number = DEFAULT_PRIZE_RANKS,
  targetReached = true,
): RowTier {
  return targetReached && rank <= recipientCount ? 'grandPrize' : 'discount';
}

/** The first rank that wins a discount rather than the grand prize. */
export function firstDiscountRank(recipientCount: number = DEFAULT_PRIZE_RANKS): number {
  return recipientCount + 1;
}
