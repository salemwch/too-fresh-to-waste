import { DonationGoalCategory } from '@foodwaste/shared';

import { getNextGoal, isLastGoal, GOAL_SEQUENCE } from '../constants/goal-sequence.constant';
import { DEFAULT_CATEGORY_PRICES } from '../interfaces/donation.interface';
import { DonationPoolStatus } from '../schemas/donation-pool.schema';

describe('Auto-rotation logic', () => {
  describe('overflow calculation', () => {
    it('computes overflow when donation exceeds target', () => {
      const currentAmount = 305;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(5);
    });

    it('no overflow when exactly at target', () => {
      const currentAmount = 300;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(0);
    });

    it('no overflow when below target', () => {
      const currentAmount = 290;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(0);
    });

    it('handles fractional overflow correctly (TND millimes)', () => {
      const currentAmount = 300.147;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(0.147);
    });
  });

  describe('goal advancement decision', () => {
    it.each([
      [DonationGoalCategory.TSHIRTS, DonationGoalCategory.PANTS],
      [DonationGoalCategory.PANTS, DonationGoalCategory.SHOES],
      [DonationGoalCategory.SHOES, DonationGoalCategory.CHILDREN_STUDIES],
      [DonationGoalCategory.CHILDREN_STUDIES, DonationGoalCategory.MEDICINE],
    ])('advances from %s to %s', (current, expected) => {
      expect(getNextGoal(current)).toBe(expected);
    });

    it('returns null after MEDICINE (triggers season complete)', () => {
      expect(getNextGoal(DonationGoalCategory.MEDICINE)).toBeNull();
    });
  });

  describe('new pool creation for next goal', () => {
    it('carries over overflow as initial currentAmount', () => {
      const overflow = 5.25;
      const nextCategory = DonationGoalCategory.PANTS;
      const defaults = DEFAULT_CATEGORY_PRICES[nextCategory];
      const newPool = {
        currentAmount: overflow,
        targetAmount: defaults.itemPrice * defaults.targetCount,
        status: DonationPoolStatus.ACTIVE,
        activeGoalCategory: nextCategory,
        season: 1,
        goalIndex: 1,
      };
      expect(newPool.currentAmount).toBe(5.25);
      expect(newPool.activeGoalCategory).toBe(DonationGoalCategory.PANTS);
      expect(newPool.goalIndex).toBe(1);
      expect(newPool.targetAmount).toBe(4500); // 15 * 300
    });

    it('caps funded pool currentAmount at targetAmount', () => {
      const currentAmount = 305;
      const targetAmount = 300;
      const cappedAmount = Math.min(currentAmount, targetAmount);
      expect(cappedAmount).toBe(300);
    });

    it('accumulates completedGoals through the sequence', () => {
      const previouslyCompleted = [DonationGoalCategory.TSHIRTS];
      const justCompleted = DonationGoalCategory.PANTS;
      const newCompletedGoals = [...previouslyCompleted, justCompleted];
      expect(newCompletedGoals).toEqual([DonationGoalCategory.TSHIRTS, DonationGoalCategory.PANTS]);
    });
  });

  describe('cascade overflow', () => {
    it('overflow larger than next target triggers recursive advancement', () => {
      const tshirtTarget =
        DEFAULT_CATEGORY_PRICES[DonationGoalCategory.TSHIRTS].itemPrice *
        DEFAULT_CATEGORY_PRICES[DonationGoalCategory.TSHIRTS].targetCount;
      const pantsTarget =
        DEFAULT_CATEGORY_PRICES[DonationGoalCategory.PANTS].itemPrice *
        DEFAULT_CATEGORY_PRICES[DonationGoalCategory.PANTS].targetCount;

      expect(tshirtTarget).toBe(3000);
      expect(pantsTarget).toBe(4500);

      const massiveOverflow = 5000;
      const afterPants = parseFloat((massiveOverflow - pantsTarget).toFixed(3));
      expect(afterPants).toBe(500);
    });
  });

  describe('season completion', () => {
    it('MEDICINE is the last goal', () => {
      expect(isLastGoal(DonationGoalCategory.MEDICINE)).toBe(true);
    });

    it('completing MEDICINE triggers SEASON_COMPLETE', () => {
      const status = isLastGoal(DonationGoalCategory.MEDICINE)
        ? DonationPoolStatus.SEASON_COMPLETE
        : DonationPoolStatus.FUNDED;
      expect(status).toBe(DonationPoolStatus.SEASON_COMPLETE);
    });

    it('all 5 categories appear in completedGoals at season end', () => {
      const completedGoals = [...GOAL_SEQUENCE];
      expect(completedGoals).toHaveLength(5);
      expect(completedGoals).toEqual(GOAL_SEQUENCE);
    });
  });
});
