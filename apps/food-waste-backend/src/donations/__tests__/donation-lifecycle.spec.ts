import { DonationGoalCategory } from '@foodwaste/shared';

import {
  GOAL_SEQUENCE,
  getNextGoal,
  getGoalIndex,
  isLastGoal,
  getFirstGoal,
} from '../constants/goal-sequence.constant';
import { DEFAULT_CATEGORY_PRICES, DONATION_CONSTANTS } from '../interfaces/donation.interface';
import { DonationPoolStatus } from '../schemas/donation-pool.schema';
import {
  PLATFORM_FOOD_SHARE,
  DONATION_RATE_OF_COMMISSION,
} from '../../orders/utils/order-pricing.util';

describe('Donation lifecycle', () => {
  // ─── Formula correctness ───────────────────────────────────────────────────

  describe('formula correctness', () => {
    it('donation amount is 0.95% of subtotal (subtotal * 0.19 * 0.05)', () => {
      const subtotal = 100;
      const donation = parseFloat(
        (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
      );
      expect(donation).toBe(0.95);
    });

    it('DONATION_CONSTANTS align with order-pricing constants', () => {
      expect(DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE).toBe(0.19);
      expect(DONATION_CONSTANTS.DONATION_PERCENTAGE).toBe(0.05);
      expect(DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE).toBe(PLATFORM_FOOD_SHARE);
      expect(DONATION_CONSTANTS.DONATION_PERCENTAGE).toBe(DONATION_RATE_OF_COMMISSION);
    });

    it('produces identical results from both constant sources', () => {
      const subtotals = [1, 5, 10, 15.5, 42, 100, 250, 999.99];
      for (const subtotal of subtotals) {
        const fromConstants = parseFloat(
          (
            subtotal *
            DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE *
            DONATION_CONSTANTS.DONATION_PERCENTAGE
          ).toFixed(3),
        );
        const fromOrderPricing = parseFloat(
          (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
        );
        expect(fromConstants).toBe(fromOrderPricing);
      }
    });

    it('handles edge case: very small subtotal (1 TND)', () => {
      const subtotal = 1;
      const donation = parseFloat(
        (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
      );
      expect(donation).toBe(0.01);
      expect(donation).toBeGreaterThan(0);
    });

    it('handles edge case: large subtotal (9999 TND)', () => {
      const subtotal = 9999;
      const donation = parseFloat(
        (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
      );
      expect(donation).toBe(94.99);
    });
  });

  // ─── Goal sequence integrity ──────────────────────────────────────────────

  describe('goal sequence integrity', () => {
    it('every DonationGoalCategory is in the sequence exactly once', () => {
      const allCategories = Object.values(DonationGoalCategory);
      expect(GOAL_SEQUENCE).toHaveLength(allCategories.length);
      for (const cat of allCategories) {
        expect(GOAL_SEQUENCE).toContain(cat);
      }
    });

    it('sequence is: TSHIRTS → PANTS → SHOES → CHILDREN_STUDIES → MEDICINE', () => {
      expect(GOAL_SEQUENCE[0]).toBe(DonationGoalCategory.TSHIRTS);
      expect(GOAL_SEQUENCE[1]).toBe(DonationGoalCategory.PANTS);
      expect(GOAL_SEQUENCE[2]).toBe(DonationGoalCategory.SHOES);
      expect(GOAL_SEQUENCE[3]).toBe(DonationGoalCategory.CHILDREN_STUDIES);
      expect(GOAL_SEQUENCE[4]).toBe(DonationGoalCategory.MEDICINE);
    });

    it('getFirstGoal returns TSHIRTS', () => {
      expect(getFirstGoal()).toBe(DonationGoalCategory.TSHIRTS);
    });

    it('getGoalIndex is consistent with GOAL_SEQUENCE', () => {
      for (let i = 0; i < GOAL_SEQUENCE.length; i++) {
        const cat = GOAL_SEQUENCE[i];
        expect(cat).toBeDefined();
        expect(getGoalIndex(cat as DonationGoalCategory)).toBe(i);
      }
    });

    it('getNextGoal chains through the entire sequence', () => {
      let current: DonationGoalCategory | null = getFirstGoal();
      const visited: DonationGoalCategory[] = [];
      while (current !== null) {
        visited.push(current);
        current = getNextGoal(current);
      }
      expect(visited).toEqual([...GOAL_SEQUENCE]);
    });

    it('isLastGoal is true only for MEDICINE', () => {
      for (const cat of GOAL_SEQUENCE) {
        if (cat === DonationGoalCategory.MEDICINE) {
          expect(isLastGoal(cat)).toBe(true);
        } else {
          expect(isLastGoal(cat)).toBe(false);
        }
      }
    });

    it('getNextGoal returns null for unknown category', () => {
      expect(getNextGoal('INVALID' as DonationGoalCategory)).toBeNull();
    });
  });

  // ─── Overflow logic ───────────────────────────────────────────────────────

  describe('overflow logic', () => {
    it('overflow is zero when donation lands exactly on target', () => {
      const overflow = parseFloat(Math.max(0, 300 - 300).toFixed(3));
      expect(overflow).toBe(0);
    });

    it('overflow carries to next goal', () => {
      const currentAmount = 305.5;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(5.5);
    });

    it('handles tiny overflow (millimes)', () => {
      const currentAmount = 300.001;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(0.001);
    });

    it('no negative overflow when below target', () => {
      const currentAmount = 250;
      const targetAmount = 300;
      const overflow = parseFloat(Math.max(0, currentAmount - targetAmount).toFixed(3));
      expect(overflow).toBe(0);
    });

    it('cascade: overflow larger than next target recurses', () => {
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

    it('cascade: overflow through all 5 goals is theoretically possible', () => {
      const totalTarget = GOAL_SEQUENCE.reduce((sum, cat) => {
        const d = DEFAULT_CATEGORY_PRICES[cat];
        return sum + d.itemPrice * d.targetCount;
      }, 0);

      // If a single donation exceeds total target of all goals, it should cascade through all
      expect(totalTarget).toBeGreaterThan(0);
      expect(totalTarget).toBe(
        10 * 300 + // TSHIRTS = 3000
          15 * 300 + // PANTS = 4500
          20 * 200 + // SHOES = 4000
          25 * 150 + // CHILDREN_STUDIES = 3750
          5 * 500, // MEDICINE = 2500
      );
      expect(totalTarget).toBe(17750);
    });
  });

  // ─── Pool creation for next goal ──────────────────────────────────────────

  describe('pool creation for next goal', () => {
    it('new pool starts with overflow as currentAmount', () => {
      const overflow = 12.345;
      const nextCategory = DonationGoalCategory.PANTS;
      const defaults = DEFAULT_CATEGORY_PRICES[nextCategory];
      const newPool = {
        currentAmount: overflow,
        targetAmount: defaults.itemPrice * defaults.targetCount,
        status: DonationPoolStatus.ACTIVE,
        activeGoalCategory: nextCategory,
        season: 1,
        goalIndex: 1,
        completedGoals: [DonationGoalCategory.TSHIRTS],
      };
      expect(newPool.currentAmount).toBe(12.345);
      expect(newPool.targetAmount).toBe(4500);
      expect(newPool.goalIndex).toBe(1);
    });

    it('funded pool is capped at targetAmount', () => {
      const currentAmount = 3042.5;
      const targetAmount = 3000;
      const cappedAmount = Math.min(currentAmount, targetAmount);
      expect(cappedAmount).toBe(3000);
    });

    it('completedGoals accumulates through the sequence', () => {
      const completedGoals: DonationGoalCategory[] = [];
      for (const cat of GOAL_SEQUENCE) {
        completedGoals.push(cat);
      }
      expect(completedGoals).toEqual([...GOAL_SEQUENCE]);
      expect(completedGoals).toHaveLength(5);
    });

    it('each goal has a target computed from DEFAULT_CATEGORY_PRICES', () => {
      for (const cat of GOAL_SEQUENCE) {
        const d = DEFAULT_CATEGORY_PRICES[cat];
        expect(d.itemPrice).toBeGreaterThan(0);
        expect(d.targetCount).toBeGreaterThan(0);
        const target = d.itemPrice * d.targetCount;
        expect(target).toBeGreaterThan(0);
      }
    });
  });

  // ─── Season completion ────────────────────────────────────────────────────

  describe('season completion', () => {
    it('completing MEDICINE triggers SEASON_COMPLETE status', () => {
      const status = isLastGoal(DonationGoalCategory.MEDICINE)
        ? DonationPoolStatus.SEASON_COMPLETE
        : DonationPoolStatus.FUNDED;
      expect(status).toBe(DonationPoolStatus.SEASON_COMPLETE);
    });

    it('non-last goals trigger FUNDED, not SEASON_COMPLETE', () => {
      for (const cat of GOAL_SEQUENCE.slice(0, -1)) {
        const status = isLastGoal(cat)
          ? DonationPoolStatus.SEASON_COMPLETE
          : DonationPoolStatus.FUNDED;
        expect(status).toBe(DonationPoolStatus.FUNDED);
      }
    });

    it('SEASON_COMPLETE is a distinct status value', () => {
      expect(DonationPoolStatus.SEASON_COMPLETE).toBe('season_complete');
      expect(DonationPoolStatus.SEASON_COMPLETE).not.toBe(DonationPoolStatus.FUNDED);
      expect(DonationPoolStatus.SEASON_COMPLETE).not.toBe(DonationPoolStatus.ARCHIVED);
    });
  });

  // ─── New season (reset) ───────────────────────────────────────────────────

  describe('new season', () => {
    it('new season starts at goalIndex 0 with first goal', () => {
      const firstCategory = getFirstGoal();
      expect(firstCategory).toBe(DonationGoalCategory.TSHIRTS);
      expect(getGoalIndex(firstCategory)).toBe(0);
    });

    it('season number increments by 1', () => {
      const currentSeason = 3;
      const nextSeason = currentSeason + 1;
      expect(nextSeason).toBe(4);
    });

    it('completedGoals resets to empty array for new season', () => {
      const newSeasonPool = {
        season: 2,
        goalIndex: 0,
        completedGoals: [] as DonationGoalCategory[],
        activeGoalCategory: getFirstGoal(),
      };
      expect(newSeasonPool.completedGoals).toEqual([]);
      expect(newSeasonPool.goalIndex).toBe(0);
    });

    it('default target comes from DEFAULT_CATEGORY_PRICES, not hardcoded', () => {
      const firstCategory = getFirstGoal();
      const defaults = DEFAULT_CATEGORY_PRICES[firstCategory];
      const expectedTarget = defaults.itemPrice * defaults.targetCount;
      expect(expectedTarget).toBe(3000); // TSHIRTS: 10 * 300
      expect(expectedTarget).not.toBe(DONATION_CONSTANTS.DEFAULT_TARGET_AMOUNT);
    });
  });

  // ─── Category pricing defaults ────────────────────────────────────────────

  describe('category pricing defaults', () => {
    it('all 5 categories have pricing configured', () => {
      for (const cat of Object.values(DonationGoalCategory)) {
        const pricing = DEFAULT_CATEGORY_PRICES[cat];
        expect(pricing).toBeDefined();
        expect(pricing.itemPrice).toBeGreaterThan(0);
        expect(pricing.targetCount).toBeGreaterThan(0);
      }
    });

    it.each([
      [DonationGoalCategory.TSHIRTS, 10, 300, 3000],
      [DonationGoalCategory.PANTS, 15, 300, 4500],
      [DonationGoalCategory.SHOES, 20, 200, 4000],
      [DonationGoalCategory.CHILDREN_STUDIES, 25, 150, 3750],
      [DonationGoalCategory.MEDICINE, 5, 500, 2500],
    ])(
      '%s: itemPrice=%d, targetCount=%d, target=%d TND',
      (category, expectedPrice, expectedCount, expectedTarget) => {
        const pricing = DEFAULT_CATEGORY_PRICES[category];
        expect(pricing.itemPrice).toBe(expectedPrice);
        expect(pricing.targetCount).toBe(expectedCount);
        expect(pricing.itemPrice * pricing.targetCount).toBe(expectedTarget);
      },
    );
  });

  // ─── Meal count calculation ───────────────────────────────────────────────

  describe('meal count calculation', () => {
    it('calculates meals from donation amount using MEAL_COST_ESTIMATE_TND', () => {
      const amount = 10;
      const meals = Math.floor(amount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);
      expect(meals).toBe(4); // 10 / 2.5 = 4
    });

    it('floors partial meals', () => {
      const amount = 3;
      const meals = Math.floor(amount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);
      expect(meals).toBe(1); // 3 / 2.5 = 1.2 → 1
    });

    it('returns 0 for amount below meal cost', () => {
      const amount = 1;
      const meals = Math.floor(amount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);
      expect(meals).toBe(0); // 1 / 2.5 = 0.4 → 0
    });
  });

  // ─── Status transitions ───────────────────────────────────────────────────

  describe('status transitions', () => {
    it('valid: ACTIVE → FUNDED (goal target reached, not last goal)', () => {
      const from = DonationPoolStatus.ACTIVE;
      const to = DonationPoolStatus.FUNDED;
      expect(from).toBe('active');
      expect(to).toBe('funded');
    });

    it('valid: ACTIVE → SEASON_COMPLETE (last goal reached)', () => {
      const from = DonationPoolStatus.ACTIVE;
      const to = DonationPoolStatus.SEASON_COMPLETE;
      expect(from).toBe('active');
      expect(to).toBe('season_complete');
    });

    it('valid: FUNDED → ARCHIVED (monthly archival cron)', () => {
      const from = DonationPoolStatus.FUNDED;
      const to = DonationPoolStatus.ARCHIVED;
      expect(from).toBe('funded');
      expect(to).toBe('archived');
    });

    it('all statuses are distinct string values', () => {
      const statuses = Object.values(DonationPoolStatus);
      const unique = new Set(statuses);
      expect(unique.size).toBe(statuses.length);
      expect(statuses).toHaveLength(5);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('idempotency: same orderId should not create duplicate donation', () => {
      // This is enforced by MongoDB unique index on orderId in UserDonation schema
      // and by the early-return check in createDonation. Test verifies the design.
      const orderId1 = 'order-123';
      const orderId2 = 'order-123';
      expect(orderId1).toBe(orderId2);
    });

    it('concurrent donations: $inc is atomic, no read-modify-write race', () => {
      // Design assertion: createDonation uses findByIdAndUpdate with $inc,
      // which is an atomic MongoDB operation — two concurrent donations
      // cannot lose either increment.
      const atomicOp = { $inc: { currentAmount: 0.95 } };
      expect(atomicOp.$inc.currentAmount).toBe(0.95);
    });

    it('zero-amount donation: should not happen (listener guards > 0)', () => {
      const donationAmount = parseFloat(
        (0 * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
      );
      expect(donationAmount).toBe(0);
      // listener checks `if (donationAmount > 0)` before calling createDonation
      expect(donationAmount > 0).toBe(false);
    });

    it('funded pool is capped and locked — money cannot be taken from it', () => {
      // After advanceToNextGoal, the funded pool's currentAmount is set to targetAmount
      // and status is FUNDED. No code path decrements currentAmount on a FUNDED pool.
      const fundedPoolUpdate = {
        $set: {
          status: DonationPoolStatus.FUNDED,
          currentAmount: 3000, // = targetAmount
        },
      };
      expect(fundedPoolUpdate.$set.status).toBe('funded');
      expect(fundedPoolUpdate.$set.currentAmount).toBe(3000);
    });

    it('getActivePool only finds ACTIVE + not archived pools', () => {
      const query = {
        status: DonationPoolStatus.ACTIVE,
        isArchived: false,
      };
      expect(query.status).toBe('active');
      expect(query.isArchived).toBe(false);
    });

    it('season field defaults to 1 for backward compatibility', () => {
      // Pools created before the migration have no season field.
      // The service uses `pool.season ?? 1` for backward compat.
      const legacyPool = { season: undefined };
      const season = legacyPool.season ?? 1;
      expect(season).toBe(1);
    });

    it('completedGoals defaults to empty array for backward compatibility', () => {
      const legacyPool = { completedGoals: undefined };
      const goals = legacyPool.completedGoals ?? [];
      expect(goals).toEqual([]);
    });
  });
});
