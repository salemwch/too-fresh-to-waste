import { Types } from 'mongoose';

/**
 * The single definition of who is ranked, and in what order.
 *
 * This existed in four places (loyalty.service twice, leaderboard-cache once,
 * prize-claim once) and the four had already drifted: prize-claim ranked on
 * `isActive` alone, with no consent filter, so a user who had opted out of the
 * leaderboard still occupied a prize rank and pushed everyone below them down
 * one. The rank a prize is awarded on has to be the rank the user was shown.
 */

/**
 * A user is ranked only if their account is active *and* they consented to
 * appear on the leaderboard. Opting out of the leaderboard opts you out of the
 * ranking entirely — including the prize ranking it decides.
 */
export const LEADERBOARD_PARTICIPANT_FILTER = {
  isActive: true,
  'leaderboardConsent.given': true,
} as const;

/**
 * Ties break on `_id`, so the older account ranks higher.
 *
 * Any stable tiebreak would do; what matters is that there *is* one. Sorting on
 * `totalPoints` alone leaves ties in an order MongoDB does not guarantee
 * between calls, so a user could be shown rank 5 by `getClaimStatus` and then
 * be rejected as rank 6 when they claimed.
 */
export const LEADERBOARD_SORT = { totalPoints: -1, _id: 1 } as const;

/**
 * Matches exactly the accounts that outrank the given one under
 * {@link LEADERBOARD_SORT}, so `countDocuments(...) + 1` is that account's
 * rank. Equivalent to its index in the sorted list, without loading the list.
 */
export const outranking = (totalPoints: number, id: Types.ObjectId): Record<string, unknown> => ({
  ...LEADERBOARD_PARTICIPANT_FILTER,
  $or: [{ totalPoints: { $gt: totalPoints } }, { totalPoints, _id: { $lt: id } }],
});
