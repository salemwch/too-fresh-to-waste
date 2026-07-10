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
  URGENT_OFFERS_HOURS_THRESHOLD: 2,
  /** Maximum number of urgent offers to fetch */
  URGENT_OFFERS_LIMIT: 10,
  /** Minimum discount percentage for hottest deals */
  HOTTEST_DEALS_MIN_DISCOUNT: 60,
  /** Maximum number of hottest deals to fetch */
  HOTTEST_DEALS_LIMIT: 10,
  /** Maximum distance for hottest deals geolocation (in meters) */
  HOTTEST_DEALS_MAX_DISTANCE: 15000,
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
    emptySubtext: 'Offers expiring within 2 hours will appear here',
    variant: 'featured' as const,
    testIDPrefix: 'urgent',
    priority: 1, // Highest priority - load first
  },
  hottest: {
    title: 'Hottest Deals 🔥',
    emptyMessage: 'No hottest deals for now',
    emptySubtext: 'Check back soon for offers with 60%+ discount',
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
