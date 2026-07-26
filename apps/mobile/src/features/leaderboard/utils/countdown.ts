/**
 * Countdown to the end of a leaderboard challenge.
 *
 * Note: VotingCard and CommunityBagGoalBanner each compute their own time
 * remaining. They are deliberately not shared — the voting card shows total
 * hours with no day component, and the banner shows ceil-days clamped at zero.
 * Only the millisecond arithmetic is common, and folding three presentations
 * into one API would obscure all three.
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export interface Countdown {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

/**
 * Time left until `endDate`, split into units.
 *
 * Returns null when there is no end date or it has passed — callers hide the
 * countdown entirely rather than showing zeros, since a finished challenge has
 * a different UI state.
 */
export function getCountdown(endDate: string | undefined): Countdown | null {
  if (!endDate) return null;

  const diff = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return null;

  return {
    days: Math.floor(diff / MS_PER_DAY),
    hours: Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR),
    mins: Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE),
    secs: Math.floor((diff % MS_PER_MINUTE) / MS_PER_SECOND),
  };
}
