/**
 * Sustainability calculation constants and formulas for environmental impact metrics
 * Based on industry research and FAO guidelines for food waste environmental impact
 */

// Food category environmental impact coefficients (per kg)
export const FOOD_IMPACT_COEFFICIENTS = {
  // Meat & Protein
  meat: {
    carbonFootprint: 27.0, // kg CO2 per kg
    waterFootprint: 15415, // liters per kg
    avgWeight: 0.5, // average weight per item in kg
  },
  fish: {
    carbonFootprint: 13.6,
    waterFootprint: 3500,
    avgWeight: 0.3,
  },
  dairy: {
    carbonFootprint: 9.8,
    waterFootprint: 1628,
    avgWeight: 0.4,
  },
  eggs: {
    carbonFootprint: 4.2,
    waterFootprint: 3265,
    avgWeight: 0.05, // per egg
  },

  // Grains & Cereals
  bread: {
    carbonFootprint: 1.4,
    waterFootprint: 1608,
    avgWeight: 0.8, // per loaf
  },
  rice: {
    carbonFootprint: 4.0,
    waterFootprint: 2497,
    avgWeight: 0.5,
  },
  pasta: {
    carbonFootprint: 1.1,
    waterFootprint: 1849,
    avgWeight: 0.5,
  },

  // Fruits & Vegetables
  vegetables: {
    carbonFootprint: 2.0,
    waterFootprint: 287,
    avgWeight: 0.3,
  },
  fruits: {
    carbonFootprint: 1.1,
    waterFootprint: 962,
    avgWeight: 0.2,
  },

  // Prepared Foods
  prepared_meals: {
    carbonFootprint: 5.5, // Mixed category average
    waterFootprint: 2500,
    avgWeight: 0.6,
  },
  desserts: {
    carbonFootprint: 3.2,
    waterFootprint: 1200,
    avgWeight: 0.3,
  },
  beverages: {
    carbonFootprint: 0.7,
    waterFootprint: 168,
    avgWeight: 0.5, // per bottle/can
  },

  // Default fallback for unknown categories
  default: {
    carbonFootprint: 3.5, // Average across all food categories
    waterFootprint: 1500,
    avgWeight: 0.4,
  },
} as const;

// Offer type multipliers for portion estimation
export const OFFER_TYPE_MULTIPLIERS = {
  surprise_bag: 2.5, // Surprise bags typically contain multiple items
  specific_items: 1.0, // Single item basis
  meal_deal: 1.8, // Meal deals contain multiple components
} as const;

// Additional sustainability factors
export const SUSTAINABILITY_FACTORS = {
  // Packaging waste reduction factor (kg plastic saved per food kg)
  packagingReduction: 0.15,

  // Transportation emissions saved (kg CO2 per km not traveled)
  transportationSaved: 0.21,

  // Average distance food travels before waste (km)
  avgFoodMiles: 2400,

  // Food waste disposal emissions (kg CO2 per kg food)
  disposalEmissions: 3.3,

  // Energy savings from avoiding food production (kWh per kg)
  energySavings: 4.2,
} as const;

// Weight estimation rules for offers without explicit weight data
export const WEIGHT_ESTIMATION_RULES = {
  // Base weight estimation from categories
  getCategoryWeight: (categories: string[]): number => {
    if (categories.length === 0) {
      return FOOD_IMPACT_COEFFICIENTS.default.avgWeight;
    }

    let totalWeight = 0;
    let matchedCategories = 0;

    for (const category of categories) {
      const normalizedCategory = category.toLowerCase().trim();

      // Find matching coefficient category
      for (const [key, value] of Object.entries(FOOD_IMPACT_COEFFICIENTS)) {
        if (key === 'default') {
          continue;
        }

        if (
          normalizedCategory.includes(key) ||
          normalizedCategory.includes(key.slice(0, -1)) || // Handle plurals
          key.includes(normalizedCategory)
        ) {
          totalWeight += value.avgWeight;
          matchedCategories++;
          break;
        }
      }
    }

    return matchedCategories > 0
      ? totalWeight / matchedCategories
      : FOOD_IMPACT_COEFFICIENTS.default.avgWeight;
  },

  // Parse weight from description or estimated weight field
  parseWeightFromText: (text: string): number | null => {
    if (!text) {
      return null;
    }

    const weightRegex = /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|kilogram|kilograms)/i;
    const match = text.match(weightRegex);

    if (match) {
      const value = parseFloat(match[1] ?? '0');
      const unit = (match[2] ?? 'kg').toLowerCase();

      // Convert to kg
      return unit.startsWith('g') ? value / 1000 : value;
    }

    return null;
  },
} as const;

/**
 * Bag-level impact constants — the SINGLE SOURCE OF TRUTH for rescued-food
 * impact, shared by the merchant sustainability endpoints and the admin
 * platform analytics.
 *
 * ⚠️ Both surfaces MUST derive from these. Admin analytics previously carried
 * its own inline numbers (0.35 kg/item, 2.3 kg CO₂/kg, 0.3 kg/meal), which
 * under-reported platform CO₂ by ~6.5× versus the merchant dashboards for the
 * same orders. Never reintroduce local copies.
 *
 * Methodology: ADEME (French Agency for Ecological Transition) Scope 3.
 */
export const BAG_IMPACT = {
  /** Average surprise bag: ~1.5 kg mixed food (ADEME research) */
  avgKgPerBag: 1.5,
  /** Weighted-average carbon footprint of the rescued food mix (kg CO₂ per kg) */
  carbonPerKg: FOOD_IMPACT_COEFFICIENTS.default.carbonFootprint,
  /** Weighted-average water footprint (litres per kg) */
  waterPerKg: FOOD_IMPACT_COEFFICIENTS.default.waterFootprint,
  /** ADEME: 1 kg of food ≈ 1.67 meals */
  mealsPerKg: 1.67,
  /** Market estimate for Tunisia (TND per kg of rescued food) */
  tndValuePerKg: 5.0,
  /** One tree absorbs ~21 kg CO₂ per year */
  co2PerTreeYear: 21,
  /** Average car emits 120 g CO₂ per km */
  gramsCo2PerCarKm: 120,
  /** Assumed meals consumed per person per day */
  mealsPerPersonPerDay: 3,
} as const;

// Cache TTL for sustainability calculations (5 minutes)
export const SUSTAINABILITY_CACHE_TTL = 5 * 60 * 1000;

// Minimum thresholds for meaningful calculations
export const CALCULATION_THRESHOLDS = {
  minOrdersForCalculation: 1,
  minQuantityForCalculation: 1,
  maxReasonableWeightPerItem: 50, // kg - sanity check
  minReasonableWeightPerItem: 0.01, // kg - sanity check
} as const;
