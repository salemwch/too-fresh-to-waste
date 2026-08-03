import { DonationGoalCategory } from '@foodwaste/shared';

export const GOAL_SEQUENCE: readonly DonationGoalCategory[] = [
  DonationGoalCategory.TSHIRTS,
  DonationGoalCategory.PANTS,
  DonationGoalCategory.SHOES,
  DonationGoalCategory.CHILDREN_STUDIES,
  DonationGoalCategory.MEDICINE,
] as const;

export function getGoalIndex(category: DonationGoalCategory): number {
  return GOAL_SEQUENCE.indexOf(category);
}

export function getNextGoal(current: DonationGoalCategory): DonationGoalCategory | null {
  const idx = getGoalIndex(current);
  if (idx === -1 || idx === GOAL_SEQUENCE.length - 1) {
    return null;
  }
  return GOAL_SEQUENCE[idx + 1] ?? null;
}

export function isLastGoal(category: DonationGoalCategory): boolean {
  return getGoalIndex(category) === GOAL_SEQUENCE.length - 1;
}

export function getFirstGoal(): DonationGoalCategory {
  // GOAL_SEQUENCE is a compile-time constant with at least one element
  return GOAL_SEQUENCE[0] as DonationGoalCategory;
}
