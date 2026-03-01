/**
 * Filter Options Constants
 *
 * Predefined filter options for the search experience
 */

import { EstablishmentType, OfferType } from '@/features/offers/types/offer.types';

// ============================================================================
// Establishment Types with Icons
// ============================================================================

export interface EstablishmentTypeOption {
  value: EstablishmentType;
  label: string;
  icon: string;
}

export const ESTABLISHMENT_TYPE_OPTIONS: EstablishmentTypeOption[] = [
  { value: EstablishmentType.BAKERY, label: 'Bakery', icon: '🍞' },
  { value: EstablishmentType.RESTAURANT, label: 'Restaurant', icon: '🍽️' },
  { value: EstablishmentType.CAFE, label: 'Cafe', icon: '☕' },
  { value: EstablishmentType.HOTEL, label: 'Hotel', icon: '🏨' },
  { value: EstablishmentType.GROCERY_STORE, label: 'Grocery', icon: '🛒' },
  { value: EstablishmentType.FAST_FOOD, label: 'Fast Food', icon: '🍔' },
  { value: EstablishmentType.SUPERMARKET, label: 'Supermarket', icon: '🏪' },
  { value: EstablishmentType.OTHER, label: 'Other', icon: '📦' },
];

// ============================================================================
// Cuisine Types with Flag Icons
// ============================================================================

export interface CuisineTypeOption {
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

export interface CategoryOption {
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

export interface OfferTypeOption {
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
