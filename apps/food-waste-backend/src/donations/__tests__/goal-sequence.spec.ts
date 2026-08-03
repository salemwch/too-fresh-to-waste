import { DonationGoalCategory } from '@foodwaste/shared';

import {
  GOAL_SEQUENCE,
  getGoalIndex,
  getNextGoal,
  isLastGoal,
  getFirstGoal,
} from '../constants/goal-sequence.constant';

describe('Goal sequence', () => {
  it('has exactly 5 categories in the expected order', () => {
    expect(GOAL_SEQUENCE).toEqual([
      DonationGoalCategory.TSHIRTS,
      DonationGoalCategory.PANTS,
      DonationGoalCategory.SHOES,
      DonationGoalCategory.CHILDREN_STUDIES,
      DonationGoalCategory.MEDICINE,
    ]);
  });

  it('covers every DonationGoalCategory exactly once', () => {
    const allCategories = Object.values(DonationGoalCategory);
    expect(GOAL_SEQUENCE).toHaveLength(allCategories.length);
    for (const cat of allCategories) {
      expect(GOAL_SEQUENCE).toContain(cat);
    }
  });

  describe('getGoalIndex', () => {
    it('returns correct index for each category', () => {
      expect(getGoalIndex(DonationGoalCategory.TSHIRTS)).toBe(0);
      expect(getGoalIndex(DonationGoalCategory.PANTS)).toBe(1);
      expect(getGoalIndex(DonationGoalCategory.SHOES)).toBe(2);
      expect(getGoalIndex(DonationGoalCategory.CHILDREN_STUDIES)).toBe(3);
      expect(getGoalIndex(DonationGoalCategory.MEDICINE)).toBe(4);
    });

    it('returns -1 for an unknown category', () => {
      expect(getGoalIndex('UNKNOWN' as DonationGoalCategory)).toBe(-1);
    });
  });

  describe('getNextGoal', () => {
    it('returns PANTS after TSHIRTS', () => {
      expect(getNextGoal(DonationGoalCategory.TSHIRTS)).toBe(DonationGoalCategory.PANTS);
    });

    it('returns SHOES after PANTS', () => {
      expect(getNextGoal(DonationGoalCategory.PANTS)).toBe(DonationGoalCategory.SHOES);
    });

    it('returns CHILDREN_STUDIES after SHOES', () => {
      expect(getNextGoal(DonationGoalCategory.SHOES)).toBe(DonationGoalCategory.CHILDREN_STUDIES);
    });

    it('returns MEDICINE after CHILDREN_STUDIES', () => {
      expect(getNextGoal(DonationGoalCategory.CHILDREN_STUDIES)).toBe(
        DonationGoalCategory.MEDICINE,
      );
    });

    it('returns null after MEDICINE (last goal)', () => {
      expect(getNextGoal(DonationGoalCategory.MEDICINE)).toBeNull();
    });

    it('returns null for unknown category', () => {
      expect(getNextGoal('UNKNOWN' as DonationGoalCategory)).toBeNull();
    });
  });

  describe('isLastGoal', () => {
    it('returns false for all goals except MEDICINE', () => {
      expect(isLastGoal(DonationGoalCategory.TSHIRTS)).toBe(false);
      expect(isLastGoal(DonationGoalCategory.PANTS)).toBe(false);
      expect(isLastGoal(DonationGoalCategory.SHOES)).toBe(false);
      expect(isLastGoal(DonationGoalCategory.CHILDREN_STUDIES)).toBe(false);
    });

    it('returns true for MEDICINE', () => {
      expect(isLastGoal(DonationGoalCategory.MEDICINE)).toBe(true);
    });
  });

  describe('getFirstGoal', () => {
    it('returns TSHIRTS', () => {
      expect(getFirstGoal()).toBe(DonationGoalCategory.TSHIRTS);
    });
  });
});
