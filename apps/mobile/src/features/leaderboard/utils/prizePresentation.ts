/**
 * How to show the season's grand prize.
 *
 * The leaderboard used to hardcode 📱 and "Smartphone" in both the tier card and
 * the info modal. A phone is only one of the six categories the community can
 * vote for, so any season that elected a hotel stay or a scooter still announced
 * a smartphone — and the winner modal, which does read the real name, then
 * contradicted the two screens that led the user to it.
 *
 * The elected prize's category is not stored on the winner record, only its
 * name. It is recoverable though: `winner.prizeId` points at an entry of the
 * cycle's own `prizes`, and that entry carries the category. Resolving it here
 * keeps the backend untouched.
 */

import { PrizeCategory } from '@foodwaste/shared';

import type { PrizeOption, VotingCycleData } from '@/features/voting/types/voting.types';

/** Shown before a season has elected anything. */
const FALLBACK_ICON = '🏆';

const CATEGORY_ICONS: Record<string, string> = {
  [PrizeCategory.PHONE]: '📱',
  [PrizeCategory.HOTEL_STAY]: '🏨',
  [PrizeCategory.SHOPPING_VOUCHER]: '🎫',
  [PrizeCategory.GYM_MEMBERSHIP]: '🏋️',
  [PrizeCategory.ELECTRIC_SCOOTER]: '🛴',
  // CUSTOM has no fixed icon by definition — an admin can name it anything.
  [PrizeCategory.CUSTOM]: FALLBACK_ICON,
};

export interface GrandPrizePresentation {
  /** Emoji for the elected category, or the trophy while none is elected. */
  icon: string;
  /**
   * The elected prize's name, or `null` when the season has not decided yet —
   * callers then fall back to a translated "prize the community votes for"
   * rather than inventing one.
   */
  name: string | null;
}

const UNDECIDED: GrandPrizePresentation = { icon: FALLBACK_ICON, name: null };

/**
 * Resolve the grand prize a season is currently offering.
 *
 * Undecided — the trophy and no name — whenever the cycle is missing, no winner
 * has been announced, or the winner's name is blank. Announcing a specific prize
 * on incomplete data is worse than announcing none: the user plans around it.
 */
export function getGrandPrizePresentation(
  cycle: VotingCycleData | null | undefined,
): GrandPrizePresentation {
  const winner = cycle?.winner;
  const name = winner?.name?.trim();
  if (!winner || !name) return UNDECIDED;

  // The elected option still lives in the ballot; it carries the category the
  // winner record dropped.
  const elected: PrizeOption | undefined = cycle?.prizes?.find(p => p._id === winner.prizeId);
  const icon = elected ? (CATEGORY_ICONS[elected.category] ?? FALLBACK_ICON) : FALLBACK_ICON;

  return { icon, name };
}

export interface PrizeRow {
  id: string;
  icon: string;
  name: string;
  /** Admin-entered worth, e.g. "1 000 DT" — rendered next to the name. */
  value: string;
  /** True for the option the community elected, so the list can mark it. */
  isElected: boolean;
}

/**
 * Every prize on this season's ballot — what a user can actually win.
 *
 * The info modal used to describe a single hardcoded smartphone tier, so someone
 * opening it to find out what is on offer learned about one prize out of five.
 * This reads the cycle's own `prizes`, which means the list can never drift from
 * what the admin configured: adding a sixth option to a season shows a sixth row
 * with no app release.
 *
 * Empty array when no cycle is loaded — the modal then keeps its explanatory
 * text and simply omits the list, rather than rendering an empty box.
 */
export function getBallotPrizeRows(cycle: VotingCycleData | null | undefined): PrizeRow[] {
  const electedId = cycle?.winner?.prizeId;

  return (cycle?.prizes ?? [])
    .filter(prize => prize.name?.trim())
    .map(prize => ({
      id: prize._id,
      icon: CATEGORY_ICONS[prize.category] ?? FALLBACK_ICON,
      name: prize.name.trim(),
      value: prize.value?.trim() ?? '',
      isElected: Boolean(electedId) && prize._id === electedId,
    }));
}
