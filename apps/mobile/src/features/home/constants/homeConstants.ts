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
  CAROUSEL_CARD_WIDTH: 332,
  /** Visible card width (snap interval minus card margin) */
  CAROUSEL_CARD_VISIBLE_WIDTH: 320,
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
 * Presentation config for each offer section.
 *
 * Only styling/test identity lives here — all user-facing copy comes from the
 * `home.*` i18n namespace (see HomeScreen), so nothing in this file is ever
 * rendered. Do NOT reintroduce title/empty-state strings here: they would
 * bypass i18n and ship untranslated English to fr/ar users.
 */
export const OFFER_SECTIONS = {
  urgent: {
    variant: 'featured' as const,
    testIDPrefix: 'urgent',
  },
  hottest: {
    variant: 'default' as const,
    testIDPrefix: 'hottest',
  },
  pickupToday: {
    variant: 'default' as const,
    testIDPrefix: 'pickup-today',
  },
  pickupTomorrow: {
    variant: 'default' as const,
    testIDPrefix: 'pickup-tomorrow',
  },
} as const;

/**
 * The four offer carousels on the home screen, as data.
 *
 * They were four near-identical JSX blocks differing only in these fields —
 * thirteen props each, twelve of them the same shape. A table makes adding or
 * reordering a section a one-line change and stops the four drifting apart, the
 * way the search offer mappers did before they were centralised.
 *
 * Only the static half lives here; offers, loading and error state are keyed by
 * `id` at the call site because they come from the query hooks.
 */
export const HOME_OFFER_SECTIONS = [
  {
    id: 'urgentOffers',
    titleKey: 'home.urgentDeals',
    /** Appended to the title — kept out of the translation so it cannot be lost. */
    titleSuffix: ' ⚡',
    emptyKey: 'home.noUrgentDeals',
    subtextKey: 'home.urgentSubtext',
    mascotVariant: 'urgent',
    mascotCopyKey: 'home.mascotUrgent',
    section: OFFER_SECTIONS.urgent,
  },
  {
    id: 'hottestDeals',
    titleKey: 'home.hottestDeals',
    titleSuffix: ' 🔥',
    emptyKey: 'home.noHottestDeals',
    subtextKey: 'home.hottestSubtext',
    mascotVariant: 'hottest',
    mascotCopyKey: 'home.mascotHottest',
    section: OFFER_SECTIONS.hottest,
  },
  {
    id: 'pickupToday',
    titleKey: 'home.pickupToday',
    titleSuffix: '',
    emptyKey: 'home.noPickupToday',
    subtextKey: 'home.pickupSubtext',
    mascotVariant: 'today',
    mascotCopyKey: 'home.mascotToday',
    section: OFFER_SECTIONS.pickupToday,
  },
  {
    id: 'pickupTomorrow',
    titleKey: 'home.pickupTomorrow',
    titleSuffix: '',
    emptyKey: 'home.noPickupTomorrow',
    subtextKey: 'home.pickupSubtext',
    mascotVariant: 'tomorrow',
    mascotCopyKey: 'home.mascotTomorrow',
    section: OFFER_SECTIONS.pickupTomorrow,
  },
] as const;

export type HomeOfferSectionId = (typeof HOME_OFFER_SECTIONS)[number]['id'];

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
