/**
 * Home Screen Constants
 * Centralized configuration for HomeScreen and related components
 *
 * Best Practice: Extract magic numbers and hardcoded data to constants
 * for better maintainability, reusability, and testability
 */

// ============================================================================
// API Configuration
// ============================================================================

/**
 * Configuration for home screen data fetching
 */
export const HOME_API_CONFIG = {
  /** Hours threshold for urgent offers (offers expiring within X hours) */
  URGENT_OFFERS_HOURS_THRESHOLD: 1,
  /** Maximum number of urgent offers to fetch */
  URGENT_OFFERS_LIMIT: 10,
  /** Minimum discount percentage for hottest deals */
  HOTTEST_DEALS_MIN_DISCOUNT: 70,
  /** Maximum number of hottest deals to fetch */
  HOTTEST_DEALS_LIMIT: 10,
  /** Maximum distance for hottest deals geolocation (in meters) */
  HOTTEST_DEALS_MAX_DISTANCE: 10000,
  /** Maximum number of pickup today offers to fetch */
  PICKUP_TODAY_LIMIT: 20,
  /** Maximum number of pickup tomorrow offers to fetch */
  PICKUP_TOMORROW_LIMIT: 20,
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Configuration for home screen UI behavior
 */
export const HOME_UI_CONFIG = {
  /** Debounce delay for search input (milliseconds) */
  SEARCH_DEBOUNCE_MS: 300,
  /** Delay before lazy loading secondary data (milliseconds) */
  LAZY_LOAD_DELAY_MS: 500,
  /** Width of carousel cards for snap-to-interval (pixels) */
  CAROUSEL_CARD_WIDTH: 300,
  /** Number of skeleton cards to show during loading */
  SKELETON_CARD_COUNT: 3,
  /** Refresh control tint color intensity (0-1) */
  REFRESH_CONTROL_OPACITY: 1,
} as const;

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * AsyncStorage keys for persisting home screen data
 */
export const HOME_STORAGE_KEYS = {
  /** Key for storing location setup completion status */
  LOCATION_SETUP_COMPLETED: '@location_required_v1',
  /** Key for storing user filter preferences */
  FILTERS: '@home_filters_v1',
} as const;

// ============================================================================
// Categories Configuration
// ============================================================================

/**
 * Browse by category configuration
 * Each category has an ID, display name, and emoji icon
 */
export const HOME_CATEGORIES = [
  {
    id: 'bakery',
    name: 'Bakery',
    icon: '🥖',
    description: 'Fresh bread, pastries, and baked goods',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    icon: '🍽️',
    description: 'Hot meals and dining experiences',
  },
  {
    id: 'grocery',
    name: 'Grocery',
    icon: '🛒',
    description: 'Fresh produce and grocery items',
  },
  {
    id: 'cafe',
    name: 'Cafe',
    icon: '☕',
    description: 'Coffee, drinks, and light snacks',
  },
] as const;

/**
 * Type-safe category ID union
 */
export type HomeCategoryId = (typeof HOME_CATEGORIES)[number]['id'];

// ============================================================================
// Offer Section Configuration
// ============================================================================

/**
 * Configuration for each offer section
 * Used to render offer sections with consistent styling and behavior
 */
export const OFFER_SECTIONS = {
  urgent: {
    title: 'Urgent Deals ⚡',
    emptyMessage: 'No urgent deals right now',
    emptySubtext: 'Offers expiring within 1 hour will appear here',
    variant: 'featured' as const,
    testIDPrefix: 'urgent',
    priority: 1, // Highest priority - load first
  },
  hottest: {
    title: 'Hottest Deals 🔥',
    emptyMessage: 'No hottest deals for now',
    emptySubtext: 'Check back soon for offers with 70%+ discount',
    variant: 'default' as const,
    testIDPrefix: 'hottest',
    priority: 2,
  },
  pickupToday: {
    title: 'Pickup Today',
    emptyMessage: 'No offers available for pickup today',
    emptySubtext: 'Check back later or browse other offers',
    variant: 'default' as const,
    testIDPrefix: 'pickup-today',
    priority: 3,
  },
  pickupTomorrow: {
    title: 'Pickup Tomorrow',
    emptyMessage: 'No offers available for pickup tomorrow',
    emptySubtext: 'Check back later or browse other offers',
    variant: 'default' as const,
    testIDPrefix: 'pickup-tomorrow',
    priority: 4,
  },
} as const;

/**
 * Type-safe offer section key union
 */
export type OfferSectionKey = keyof typeof OFFER_SECTIONS;

// ============================================================================
// Analytics Event Names
// ============================================================================

/**
 * Analytics event names for home screen tracking
 */
export const HOME_ANALYTICS_EVENTS = {
  SCREEN_VIEW: 'home_screen_viewed',
  SEARCH_PERFORMED: 'home_search_performed',
  FILTER_APPLIED: 'home_filter_applied',
  FILTER_CLEARED: 'home_filter_cleared',
  FILTER_REMOVED: 'home_filter_chip_removed',
  CATEGORY_PRESSED: 'home_category_pressed',
  OFFER_PRESSED: 'home_offer_pressed',
  LOCATION_ENABLED: 'home_location_enabled',
  LOCATION_DISMISSED: 'home_location_prompt_dismissed',
  IMPACT_BANNER_EXPANDED: 'home_impact_banner_expanded',
  REFRESH_TRIGGERED: 'home_refresh_triggered',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

/**
 * User-facing error messages
 */
export const HOME_ERROR_MESSAGES = {
  URGENT_LOAD_FAILED: 'Failed to load urgent deals',
  HOTTEST_LOAD_FAILED: 'Failed to load hottest deals',
  PICKUP_TODAY_LOAD_FAILED: 'Failed to load pickup today offers',
  PICKUP_TOMORROW_LOAD_FAILED: 'Failed to load pickup tomorrow offers',
  LOCATION_FETCH_FAILED: 'Failed to fetch location from backend',
  FILTER_PERSIST_FAILED: 'Failed to save filter preferences',
  FILTER_LOAD_FAILED: 'Failed to load filter preferences',
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type-safe accessor for API config values
 */
export type HomeApiConfig = typeof HOME_API_CONFIG;

/**
 * Type-safe accessor for UI config values
 */
export type HomeUiConfig = typeof HOME_UI_CONFIG;

/**
 * Type-safe accessor for storage keys
 */
export type HomeStorageKeys = typeof HOME_STORAGE_KEYS;

/**
 * Type-safe accessor for categories
 */
export type HomeCategory = (typeof HOME_CATEGORIES)[number];

/**
 * Type-safe accessor for offer sections
 */
export type OfferSectionConfig = (typeof OFFER_SECTIONS)[OfferSectionKey];
