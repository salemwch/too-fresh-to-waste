import { Types } from 'mongoose';

/**
 * The single definition of who is ranked, and in what order.
 *
 * This existed in four places (loyalty.service twice, leaderboard-cache once,
 * prize-claim once) and the four had already drifted, so the rank a user was
 * shown was not the rank their prize was decided on.
 */

/**
 * Every active account is ranked.
 *
 * Leaderboard consent is about **the name**, not about taking part:
 * `showRealName` masks a user as "Anonymous", and `given` only records whether
 * they have answered the consent prompt yet. You earn your points and your
 * prize whether or not your name is visible.
 *
 * Filtering the ranking on `leaderboardConsent.given` was wrong twice over — it
 * dropped users who had merely never been asked, and it made the public ranks
 * disagree with the ranks prizes were awarded on.
 */
export const LEADERBOARD_PARTICIPANT_FILTER = {
  isActive: true,
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
