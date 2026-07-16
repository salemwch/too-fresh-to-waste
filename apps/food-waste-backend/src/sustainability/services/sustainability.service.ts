import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrderStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { MerchantGoal, MerchantGoalDocument } from '../schemas/merchant-goal.schema';
import {
  FOOD_IMPACT_COEFFICIENTS,
  SUSTAINABILITY_FACTORS,
} from '../../analytics/constants/sustainability.constants';
import type {
  EsgTierResponse,
  EsgTierInfo,
  MonthlyGoalResponse,
  CarbonMetricsResponse,
  SocialImpactResponse,
} from '../dto/sustainability.dto';

// ── ESG Tier definitions ──────────────────────────────────────────────────────

const ESG_TIERS: { name: string; label: string; badge: string | null; threshold: number }[] = [
  { name: 'Apprenti', label: 'Apprenti', badge: null, threshold: 0 },
  { name: 'EcoActeur', label: 'Éco-Acteur', badge: null, threshold: 50 },
  { name: 'Ambassadeur', label: 'Ambassadeur', badge: null, threshold: 150 },
  { name: 'AmbassadeurElite', label: 'Ambassadeur', badge: 'Élite', threshold: 300 },
  { name: 'Legende', label: 'Légende', badge: null, threshold: 500 },
];

// Average surprise bag: ~1.5 kg mixed food (ADEME research)
const AVG_KG_PER_BAG = 1.5;
// Average carbon footprint of rescued food mix (weighted avg, ADEME)
const AVG_CARBON_PER_KG = FOOD_IMPACT_COEFFICIENTS.default.carbonFootprint; // 3.5 kg CO2/kg
// Average water footprint (weighted avg)
const AVG_WATER_PER_KG = FOOD_IMPACT_COEFFICIENTS.default.waterFootprint; // 1500 L/kg
// Meals per bag (ADEME: 1 kg food ≈ 1.67 meals)
const MEALS_PER_KG = 1.67;
// Average TND value per meal (market estimate for Tunisia)
const TND_VALUE_PER_KG = 5.0;
// Trees planted equivalent: 1 tree absorbs ~21 kg CO2/year
const CO2_PER_TREE_YEAR = 21;

@Injectable()
export class SustainabilityService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(MerchantGoal.name) private readonly goalModel: Model<MerchantGoalDocument>,
  ) {}

  // ── All-time bags saved ───────────────────────────────────────────────────

  async getAllTimeBagsSaved(merchantId: string, establishmentId?: string): Promise<number> {
    const matchStage: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
      status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
      isDeleted: { $ne: true },
    };
    if (establishmentId) {
      matchStage['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matchStage },
        {
          $project: {
            bagCount: { $sum: '$items.quantity' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$bagCount' },
          },
        },
      ])
      .exec();

    return (result[0] as { total?: number } | undefined)?.total ?? 0;
  }

  // ── ESG Tier ─────────────────────────────────────────────────────────────

  async getEsgTier(merchantId: string, establishmentId?: string): Promise<EsgTierResponse> {
    const bagsSaved = await this.getAllTimeBagsSaved(merchantId, establishmentId);

    // Find current tier (highest threshold not exceeding bagsSaved)
    let currentIndex = 0;
    for (let i = ESG_TIERS.length - 1; i >= 0; i--) {
      if (bagsSaved >= (ESG_TIERS[i]?.threshold ?? 0)) {
        currentIndex = i;
        break;
      }
    }

    const current = ESG_TIERS[currentIndex]!;
    const next = ESG_TIERS[currentIndex + 1] ?? null;

    // Ring progress: within-tier progress toward next tier
    let ringProgress = 100;
    if (next) {
      const tierRange = next.threshold - current.threshold;
      const progressInTier = bagsSaved - current.threshold;
      ringProgress = Math.min(Math.round((progressInTier / tierRange) * 100), 100);
    }

    const allTiers: EsgTierInfo[] = ESG_TIERS.map(tier => ({
      name: tier.name,
      label: tier.badge ? `${tier.label} ${tier.badge}` : tier.label,
      badge: tier.badge,
      threshold: tier.threshold,
      reached: bagsSaved >= tier.threshold,
    }));

    return {
      currentTier: current.name,
      currentLabel: current.label,
      currentBadge: current.badge,
      bagsSaved,
      ringProgress,
      nextTier: next?.name ?? null,
      nextMilestoneAt: next?.threshold ?? null,
      remaining: next ? Math.max(0, next.threshold - bagsSaved) : null,
      allTiers,
    };
  }

  // ── Monthly goal ─────────────────────────────────────────────────────────

  private async getOrCreateGoal(merchantId: string): Promise<MerchantGoalDocument> {
    const existing = await this.goalModel
      .findOne({ merchantId: new Types.ObjectId(merchantId) })
      .exec();

    if (existing) {
      return existing;
    }

    return this.goalModel.create({
      merchantId: new Types.ObjectId(merchantId),
      targetBagsPerMonth: 300,
    });
  }

  async getMonthlyGoal(merchantId: string, establishmentId?: string): Promise<MonthlyGoalResponse> {
    const goal = await this.getOrCreateGoal(merchantId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const matchStage: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
      status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
      isDeleted: { $ne: true },
      createdAt: { $gte: startOfMonth },
    };
    if (establishmentId) {
      matchStage['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matchStage },
        {
          $project: { bagCount: { $sum: '$items.quantity' } },
        },
        {
          $group: { _id: null, total: { $sum: '$bagCount' } },
        },
      ])
      .exec();

    const currentMonthBags = (result[0] as { total?: number } | undefined)?.total ?? 0;
    const targetBags = goal.targetBagsPerMonth;
    const progressPercentage = Math.min(Math.round((currentMonthBags / targetBags) * 100), 100);
    const carbonAvoided = currentMonthBags * AVG_KG_PER_BAG * AVG_CARBON_PER_KG;
    const treesEquivalent = Math.max(1, Math.round(carbonAvoided / CO2_PER_TREE_YEAR));

    return {
      targetBagsPerMonth: targetBags,
      currentMonthBags,
      progressPercentage,
      month: monthLabel,
      treesEquivalent,
    };
  }

  async updateMonthlyGoal(
    merchantId: string,
    targetBagsPerMonth: number,
    establishmentId?: string,
  ): Promise<MonthlyGoalResponse> {
    await this.goalModel
      .findOneAndUpdate(
        { merchantId: new Types.ObjectId(merchantId) },
        { targetBagsPerMonth },
        { upsert: true, new: true },
      )
      .exec();

    return this.getMonthlyGoal(merchantId, establishmentId);
  }

  // ── Carbon metrics ────────────────────────────────────────────────────────

  async getCarbonMetrics(
    merchantId: string,
    startDate?: Date,
    establishmentId?: string,
  ): Promise<CarbonMetricsResponse> {
    const matchStage: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
      status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
      isDeleted: { $ne: true },
    };
    if (startDate) {
      matchStage['createdAt'] = { $gte: startDate };
    }
    if (establishmentId) {
      matchStage['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matchStage },
        { $project: { bagCount: { $sum: '$items.quantity' } } },
        { $group: { _id: null, total: { $sum: '$bagCount' } } },
      ])
      .exec();

    const bagsSaved = (result[0] as { total?: number } | undefined)?.total ?? 0;
    const foodWeightKg = bagsSaved * AVG_KG_PER_BAG;
    const carbonKgAvoided = Math.round(foodWeightKg * AVG_CARBON_PER_KG * 10) / 10;
    const waterLitersAvoided = Math.round(foodWeightKg * AVG_WATER_PER_KG);
    const packagingKgSaved =
      Math.round(foodWeightKg * SUSTAINABILITY_FACTORS.packagingReduction * 10) / 10;
    const energyKwhSaved =
      Math.round(foodWeightKg * SUSTAINABILITY_FACTORS.energySavings * 10) / 10;
    const carKmEquivalent = Math.round(carbonKgAvoided * (1000 / 120)); // avg car: 120gCO2/km
    const treesEquivalent = Math.max(1, Math.round(carbonKgAvoided / CO2_PER_TREE_YEAR));

    const periodLabel = startDate ? `Since ${startDate.toISOString().split('T')[0]}` : 'All time';

    return {
      bagsSaved,
      foodWeightKg: Math.round(foodWeightKg * 10) / 10,
      carbonKgAvoided,
      waterLitersAvoided,
      packagingKgSaved,
      energyKwhSaved,
      carKmEquivalent,
      treesEquivalent,
      periodLabel,
    };
  }

  // ── Social impact ─────────────────────────────────────────────────────────

  async getSocialImpact(
    merchantId: string,
    startDate?: Date,
    establishmentId?: string,
  ): Promise<SocialImpactResponse> {
    const matchStage: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
      status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
      isDeleted: { $ne: true },
    };
    if (startDate) {
      matchStage['createdAt'] = { $gte: startDate };
    }
    if (establishmentId) {
      matchStage['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const result = await this.orderModel
      .aggregate([
        { $match: matchStage },
        { $project: { bagCount: { $sum: '$items.quantity' } } },
        { $group: { _id: null, total: { $sum: '$bagCount' } } },
      ])
      .exec();

    const bagsSaved = (result[0] as { total?: number } | undefined)?.total ?? 0;
    const foodWeightKg = Math.round(bagsSaved * AVG_KG_PER_BAG * 10) / 10;
    const mealsDistributed = Math.round(foodWeightKg * MEALS_PER_KG);
    const peopleServedEstimate = Math.round(mealsDistributed / 3); // 3 meals/day
    const estimatedValueTnd = Math.round(foodWeightKg * TND_VALUE_PER_KG * 10) / 10;
    const periodLabel = startDate ? `Since ${startDate.toISOString().split('T')[0]}` : 'All time';

    return {
      bagsSaved,
      mealsDistributed,
      peopleServedEstimate,
      foodWeightKg,
      estimatedValueTnd,
      periodLabel,
    };
  }
}
