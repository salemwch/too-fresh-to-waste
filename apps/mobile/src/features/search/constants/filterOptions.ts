/**
 * Filter Options Constants
 *
 * Predefined filter options for the search experience
 */

import { OfferType } from '@/features/offers/types/offer.types';

/**
 * `ESTABLISHMENT_TYPE_OPTIONS` used to live here: eight `{ value, label, icon }`
 * entries with emoji markers and hardcoded English labels.
 *
 * It was removed rather than translated, for two reasons:
 *
 *  1. **It was incomplete.** It listed 8 of the 17 `EstablishmentType` values,
 *     so a merchant registered as a pastry shop, buffet, sushi restaurant,
 *     takeaway, fruit & veg stall, butcher, drinks shop, pet store or florist
 *     could not be filtered for anywhere in the app.
 *  2. **It was a second source of truth.** The home rail, this filter sheet and
 *     the active chips each needed labels and icons for the same concept, and
 *     nothing kept them in step.
 *
 * Both are now answered by `features/offers/constants/establishmentCategories`,
 * which maps all 17 types onto 8 categories, carries i18n label keys instead of
 * English strings, and ships one duotone SVG per category in place of the
 * emoji. Import from there.
 */

// ============================================================================
// Cuisine Types with Flag Icons
// ============================================================================

interface CuisineTypeOption {
  value: string;
  label: string;
  flag: string;
}

export const CUISINE_TYPE_OPTIONS: CuisineTypeOption[] = [
  { value: 'tunisian', label: 'Tunisian', flag: '🇹🇳' },
  { value: 'italian', label: 'Italian', flag: '🇮🇹' },
  { value: 'asian', label: 'Asian', flag: '🇨🇳' },
  { value: 'french', label: 'French', flag: '🇫🇷' },
  { value: 'shami', label: 'Shami', flag: '🌙' },
  { value: 'vegetarian', label: 'Vegetarian', flag: '🥗' },
  { value: 'mediterranean', label: 'Mediterranean', flag: '🌊' },
];

// ============================================================================
// Food Categories
// ============================================================================

interface CategoryOption {
  value: string;
  label: string;
  icon?: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'pizza', label: 'Pizza', icon: '🍕' },
  { value: 'bakery', label: 'Bakery', icon: '🥐' },
  { value: 'pasta', label: 'Pasta', icon: '🍝' },
  { value: 'dessert', label: 'Dessert', icon: '🍰' },
  { value: 'breakfast', label: 'Breakfast', icon: '🥞' },
  { value: 'lunch', label: 'Lunch', icon: '🍱' },
  { value: 'dinner', label: 'Dinner', icon: '🍛' },
  { value: 'sandwich', label: 'Sandwich', icon: '🥪' },
  { value: 'salad', label: 'Salad', icon: '🥗' },
  { value: 'soup', label: 'Soup', icon: '🍲' },
  { value: 'sushi', label: 'Sushi', icon: '🍣' },
  { value: 'burger', label: 'Burger', icon: '🍔' },
];

// ============================================================================
// Offer Types with Icons
// ============================================================================

interface OfferTypeOption {
  value: OfferType | null;
  label: string;
  icon: string;
}

export const OFFER_TYPE_OPTIONS: OfferTypeOption[] = [
  { value: null, label: 'All Types', icon: '🎁' },
  { value: OfferType.SURPRISE_BAG, label: 'Surprise Bag', icon: '🎁' },
  { value: OfferType.SPECIFIC_ITEMS, label: 'Specific Items', icon: '📦' },
  { value: OfferType.MEAL_DEAL, label: 'Meal Deal', icon: '🍱' },
];
