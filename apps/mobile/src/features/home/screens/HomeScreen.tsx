/**
 * Home Screen
 * Main dashboard displaying featured offers, nearby offers, and quick actions.
 *
 * Structure:
 * - Data fetching lives in useHomeOffers; filter state in useHomeFilters;
 *   first-run location setup in useLocationSetup.
 * - The screen renders a FlashList of section descriptors (`sections`), with
 *   each section's content produced by the `renderSection` closure.
 *
 * ⚠️ FlashList contract: `sections` describes only WHICH sections exist — the
 * offers live in the closure, not in `data`. FlashList wraps each cell in a
 * PureComponent, so `extraData` MUST be kept in sync with `renderSection` or
 * the sections freeze on their first render and never show fetched offers.
 */

import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, RefreshControl, Pressable, Image } from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useSelector } from 'react-redux';

import { LocationPromptBanner } from '@/design-system/components/molecules';
import { ManualLocationModal, LocationSelectionModal } from '@/design-system/components/organisms';
import { useTheme } from '@/design-system/providers';
import { ImpactBanner } from '@/features/donations';
import { FilterBottomSheet } from '@/features/search/components';
import { useAppDispatch } from '@/hooks/redux';
import { useLocation } from '@/hooks/useLocation';
import { LocationPickerBottomSheet, LocationHeader } from '@/navigation/components';
import { reverseGeocodeAsync } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';

import heartInHandsImg from '../../../assets/images/heart-in-hands.png';
import surpriseBoxImg from '../../../assets/images/surprise-box.png';
import {
  HomeSearchBar,
  HomeOfferSection,
  SkeletonHomeSearchBar,
  MonthlyBagGoalBanner,
  CharityDonationBottomSheet,
} from '../components';
import { HOME_OFFER_SECTIONS } from '../constants/homeConstants';

import type { HomeOfferSectionId } from '../constants/homeConstants';
import {
  useHomeFilters,
  useHomeOffers,
  useLocationPicker,
  useLocationSetup,
  useRecentLocations,
  MONTHLY_BAG_GOAL_QUERY_KEY,
} from '../hooks';
import { usePrefetchOffer } from '@/features/offers/hooks/useOffers';
import { FloatingVoteTab } from '@/features/voting/components/FloatingVoteTab';

import type { HomeScreenNavigationProp } from '@/navigation/types';
import type { RootState } from '@/types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

// New imports for refactored structure

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Header sub-components (defined outside HomeScreen to avoid re-mount on render)
// ============================================================================

interface HeaderRightProps {
  onCharityPress: () => void;
  onLeaderboardPress: () => void;
}

const HomeHeaderRight: React.FC<HeaderRightProps> = ({ onCharityPress, onLeaderboardPress }) => {
  const { t } = useTranslation();

  return (
    <View style={headerRightStyles.row}>
      <Pressable
        onPress={onCharityPress}
        style={headerRightStyles.button}
        accessibilityLabel={t('home.a11yCharity')}
        accessibilityHint={t('home.a11yCharityHint')}
        accessibilityRole='button'
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Image
          source={heartInHandsImg}
          style={headerRightStyles.icon}
          accessibilityIgnoresInvertColors
        />
      </Pressable>
      <Pressable
        onPress={onLeaderboardPress}
        style={headerRightStyles.button}
        accessibilityLabel={t('home.a11yLeaderboard')}
        accessibilityHint={t('home.a11yLeaderboardHint')}
        accessibilityRole='button'
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Image
          source={surpriseBoxImg}
          style={[headerRightStyles.icon, headerRightStyles.surpriseIcon]}
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </View>
  );
};

const headerRightStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginEnd: sp[3],
    paddingTop: 8,
    paddingBottom: 4,
  },
  button: { padding: 8, marginStart: 8 },
  icon: { width: 28, height: 28 },
  surpriseIcon: { width: 24, height: 24 },
});

// ============================================================================
// Types
// ============================================================================

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

/**
 * Section types for FlatList
 * Each section type renders different content
 */
type SectionType =
  | 'locationPrompt'
  | 'searchBar'
  | 'impactBanner'
  | 'monthlyBagGoal'
  | 'urgentOffers'
  | 'hottestDeals'
  | 'pickupToday'
  | 'pickupTomorrow';

/**
 * Section data structure
 */
interface Section {
  id: string;
  type: SectionType;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * HomeScreen Component
 *
 * Responsibilities:
 * - Orchestrate child components
 * - Manage modal visibility
 * - Handle navigation
 * - Coordinate location setup
 *
 * Best Practice: Keep parent component thin - delegate logic to hooks and components
 */
/** ImpactBanner requires onExpand; nothing on this screen reacts to it. */
const NOOP = (): void => {};

/** Config by section id, so renderSection is a lookup rather than a switch. */
const OFFER_SECTION_BY_ID = Object.fromEntries(
  HOME_OFFER_SECTIONS.map(section => [section.id, section]),
) as Record<HomeOfferSectionId, (typeof HOME_OFFER_SECTIONS)[number]>;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const prefetchOffer = usePrefetchOffer();

  // ──────────────────────────────────────────────────────────────────────────
  // Location Picker State & Search
  // ──────────────────────────────────────────────────────────────────────────

  const [isCharitySheetVisible, setIsCharitySheetVisible] = useState(false);

  // ============================================================================
  // Custom Hooks - Centralized Logic
  // ============================================================================

  /**
   * Location hook - GPS and manual location management
   * (Must be above useLocationSearch so coordinates are available for geo-ranking)
   */
  const {
    coordinates,
    hasLocation,
    isLoading: isLocationLoading,
    shouldShowPrompt,
    requestLocation,
    dismissLocationPrompt,
    setManualLocationValue,
    manualLocationName,
    gpsLocationName,
    source,
  } = useLocation();

  // Stable coords for geo-ranking. Depending on raw lat/lng would recompute on
  // every GPS sample — the receiver jitters by metres while standing still, and
  // each change refires the offer queries. Rounding to one decimal (~11km) means
  // the identity only changes when the user has meaningfully moved.
  //
  // Extracted to named variables because the rule cannot statically check an
  // expression written inline in the dependency array.
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  /**
   * Filters hook - Centralized filter state management
   * Handles: filter state, search query, debouncing, persistence, analytics
   */
  const {
    filters,
    searchQuery,
    filterParams,
    setSearchQuery,
    handleApplyFilters,
    handleClearAllFilters,
    handleRemoveOfferType,
    handleRemoveEstablishmentType,
    handleRemoveCuisineType,
    handleRemoveCategory,
  } = useHomeFilters();

  /**
   * Offers hook - Centralized data fetching with lazy loading
   * Features: priority-based loading, request cancellation, centralized refetch
   */
  const {
    urgentOffers,
    hottestDeals,
    pickupTodayOffers,
    pickupTomorrowOffers,
    isLoading,
    errors,
    refetch,
  } = useHomeOffers(coordinates ?? undefined, filterParams);

  /**
   * Location setup hook - First-time setup and cross-device sync
   * Features: backend restoration, GPS fallback, modal management
   */
  const {
    showLocationSelectionModal,
    showManualLocationModal,
    locationError,
    openManualLocationModal,
    closeManualLocationModal,
    handleLocationSelection,
    handleManualLocationSelect,
  } = useLocationSetup(hasLocation, isAuthenticated, requestLocation, setManualLocationValue);

  // ============================================================================
  // Local State - UI Control
  // ============================================================================

  const { recentLocations, saveToRecentLocations } = useRecentLocations();

  const locationPicker = useLocationPicker({
    coordinates,
    requestLocation,
    setManualLocationValue,
    saveToRecentLocations,
    dispatch,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const flatListRef = useRef<FlashList<Section>>(null);

  /**
   * Home tab re-tap: scroll to top + refetch all offers
   * Uses 'tabPress' event — fires even when already focused on this tab
   */
  useEffect(() => {
    // HomeScreen is now a grandchild of BottomTab (HomeStack > HomeScreen).
    // tabPress only fires on direct BottomTab children, so we listen on the parent.
    const tabNavigator = navigation.getParent();
    if (!tabNavigator) return;

    const unsubscribe = (
      tabNavigator as unknown as {
        addListener: (event: string, callback: () => void) => () => void;
      }
    ).addListener('tabPress', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      refetch.all().catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ['donations', 'stats'] }).catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: MONTHLY_BAG_GOAL_QUERY_KEY })
        .catch(() => undefined);
    });
    return unsubscribe;
  }, [navigation, refetch, queryClient]);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Trigger reverse geocoding on mount if GPS location exists but name is missing
   * This handles cases where:
   * - App is restarted with persisted GPS coordinates
   * - Location was set before reverse geocoding feature was added
   * - Previous reverse geocoding attempt failed
   */
  useEffect(() => {
    if (source === 'gps' && coordinates && gpsLocationName == null) {
      Logger.debug(
        '[HomeScreen] GPS location exists but name missing, triggering reverse geocoding',
      );
      dispatch(reverseGeocodeAsync(coordinates))
        .unwrap()
        .then(() => {
          Logger.debug('[HomeScreen] ✅ Reverse geocoding completed on mount');
        })
        .catch((error: unknown) => {
          Logger.warn('[HomeScreen] ⚠️ Reverse geocoding failed on mount', {
            error: String(error),
          });
        });
    }
  }, [source, coordinates, gpsLocationName, dispatch]);

  /**
   * 🆕 Load recent locations from AsyncStorage on mount
   * Non-blocking: Runs in background, doesn't affect UI render
   */

  // ============================================================================
  // Header Override - Control LocationHeader from this screen
  // ============================================================================

  /**
   * Override the header to control location picker from this screen
   * Add notification and surprise box icons on the right
   * Uses useLayoutEffect to update synchronously before paint
   */
  const handleCharityPress = useCallback(() => setIsCharitySheetVisible(true), []);
  const handleLeaderboardPress = useCallback(
    () => navigation.navigate('Leaderboard'),
    [navigation],
  );
  const handleLocationPress = locationPicker.open;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <LocationHeader onPress={handleLocationPress} />,
      headerRight: () => (
        <HomeHeaderRight
          onCharityPress={handleCharityPress}
          onLeaderboardPress={handleLeaderboardPress}
        />
      ),
    });
  }, [navigation, handleCharityPress, handleLeaderboardPress, handleLocationPress]);

  // ============================================================================
  // Callbacks - Event Handlers
  // ============================================================================

  /**
   * 🆕 Save location to recent locations (non-blocking)
   * Deduplicates by coordinates, keeps max 5, persists to AsyncStorage as side effect
   */

  /**
   * Handle pull-to-refresh
   * Wrapped to prevent returning promise to event handler
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      refetch.all(),
      queryClient.invalidateQueries({ queryKey: ['donations', 'stats'] }),
      queryClient.invalidateQueries({ queryKey: MONTHLY_BAG_GOAL_QUERY_KEY }),
    ]).finally(() => {
      setRefreshing(false);
    });
  }, [refetch, queryClient]);

  /**
   * Handle enabling location from banner
   * Wrapped to prevent returning promise to event handler
   */
  const handleEnableLocation = useCallback(() => {
    void requestLocation().then(result => {
      // `aborted` means a request was already running, not that it failed —
      // falling back to manual entry there would interrupt a flow that is
      // about to succeed.
      if (!result.success && !result.aborted) {
        // If location request failed, show manual location modal
        openManualLocationModal();
      }
    });
  }, [requestLocation, openManualLocationModal]);

  /**
   * Navigate to offer details — prefetch before navigate so data is in cache during transition
   */
  const handleOfferPress = useCallback(
    (offerId: string) => {
      if (__DEV__) {
        Logger.debug('[HomeScreen] handleOfferPress called', { offerId });
      }
      prefetchOffer(offerId);
      navigation.navigate('OfferDetails', { offerId });
    },
    [navigation, prefetchOffer],
  );

  /**
   * Navigate to search with "See All"
   */
  const handleSeeAll = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  /**
   * Wrapped location selection handler
   * Prevents returning promise to event handler
   */
  const handleLocationSelectionWrapper = useCallback(
    (selected: { latitude: number; longitude: number }, name: string) => {
      void handleLocationSelection(selected, name);
    },
    [handleLocationSelection],
  );

  // ============================================================================
  // Location Picker Handlers
  // ============================================================================

  // ============================================================================
  // FlatList Data - Section Structure
  // ============================================================================

  /**
   * Build sections array dynamically based on state
   * Only include sections that should be rendered
   * ✅ SonarQube: Uses array literal instead of multiple push() calls
   */
  /**
   * The per-section query state, keyed the same way as HOME_OFFER_SECTIONS.
   *
   * Its identity changes whenever any offer data does, which is what makes
   * renderSection's identity change — and that is the signal FlashList uses to
   * repaint cells (see extraData below).
   */
  const offerSectionData = useMemo(
    () => ({
      urgentOffers: {
        offers: urgentOffers,
        isLoading: isLoading.urgent,
        error: errors.urgent,
        onRefetch: refetch.urgent,
      },
      hottestDeals: {
        offers: hottestDeals?.data,
        isLoading: isLoading.hottest,
        error: errors.hottest,
        onRefetch: refetch.hottest,
      },
      pickupToday: {
        offers: pickupTodayOffers,
        isLoading: isLoading.pickupToday,
        error: errors.pickupToday,
        onRefetch: refetch.pickupToday,
      },
      pickupTomorrow: {
        offers: pickupTomorrowOffers,
        isLoading: isLoading.pickupTomorrow,
        error: errors.pickupTomorrow,
        onRefetch: refetch.pickupTomorrow,
      },
    }),
    [
      urgentOffers,
      hottestDeals,
      pickupTodayOffers,
      pickupTomorrowOffers,
      isLoading,
      errors,
      refetch,
    ],
  );

  /**
   * Every section still loading with nothing cached — a genuine cold start
   * rather than a refetch. Only then is the skeleton right; showing it while
   * cached offers exist would blank content the user can already see.
   */
  const isInitialLoading = useMemo(
    () =>
      Object.values(offerSectionData).every(
        section => section.isLoading && section.offers?.length == null,
      ),
    [offerSectionData],
  );

  const openFilters = useCallback(() => setIsFilterVisible(true), []);

  const sections = useMemo<Section[]>(
    () => [
      // Location prompt — only when no location is set AND the first-run modal
      // is not already asking. Both were computed independently, so a new user
      // got two prompts for the same permission: the modal in front and this
      // banner behind it. Two entry points to one runtime permission is also
      // how the duplicate `request()` race became reachable. The modal owns
      // first run; the banner is the persistent affordance afterwards.
      ...(shouldShowPrompt && !showLocationSelectionModal
        ? [{ id: 'locationPrompt' as const, type: 'locationPrompt' as const }]
        : []),
      // Search bar (always shown)
      { id: 'searchBar' as const, type: 'searchBar' as const },
      // Impact banner (always shown)
      { id: 'impactBanner' as const, type: 'impactBanner' as const },
      // Community bag goal (real-time progress toward community target)
      { id: 'monthlyBagGoal' as const, type: 'monthlyBagGoal' as const },
      // Offer sections (always shown, component handles loading/error/empty states)
      { id: 'urgentOffers' as const, type: 'urgentOffers' as const },
      { id: 'hottestDeals' as const, type: 'hottestDeals' as const },
      { id: 'pickupToday' as const, type: 'pickupToday' as const },
      { id: 'pickupTomorrow' as const, type: 'pickupTomorrow' as const },
    ],
    [shouldShowPrompt, showLocationSelectionModal],
  );

  // ============================================================================
  // FlatList Render Functions
  // ============================================================================

  /**
   * Render each section based on its type
   * Single switch statement handles all section types
   */
  const renderSection = useCallback(
    ({ item }: ListRenderItemInfo<Section>) => {
      switch (item.type) {
        case 'locationPrompt':
          return (
            <View style={styles.bannerWrapper}>
              <LocationPromptBanner
                onEnable={handleEnableLocation}
                onDismiss={dismissLocationPrompt}
                isLoading={isLocationLoading}
                testID='location-prompt-banner'
              />
            </View>
          );

        case 'searchBar': {
          if (isInitialLoading) {
            return <SkeletonHomeSearchBar testID='skeleton-home-search-bar' />;
          }

          return (
            <HomeSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFilterPress={openFilters}
              onRemoveOfferType={handleRemoveOfferType}
              onRemoveEstablishmentType={handleRemoveEstablishmentType}
              onRemoveCuisineType={handleRemoveCuisineType}
              onRemoveCategory={handleRemoveCategory}
              onClearAllFilters={handleClearAllFilters}
            />
          );
        }

        case 'impactBanner':
          return (
            <View style={styles.bannerWrapper}>
              <ImpactBanner onExpand={NOOP} />
            </View>
          );

        case 'monthlyBagGoal':
          return (
            <View style={styles.bannerWrapper}>
              <MonthlyBagGoalBanner />
            </View>
          );

        // All four carousels take the same shape; only their copy and data
        // differ, and both come from the table. See HOME_OFFER_SECTIONS.
        case 'urgentOffers':
        case 'hottestDeals':
        case 'pickupToday':
        case 'pickupTomorrow': {
          const config = OFFER_SECTION_BY_ID[item.type];
          const data = offerSectionData[item.type];

          return (
            <HomeOfferSection
              title={t(config.titleKey) + config.titleSuffix}
              offers={data.offers}
              isLoading={data.isLoading}
              error={data.error}
              onRefetch={data.onRefetch}
              onOfferPress={handleOfferPress}
              onSeeAllPress={handleSeeAll}
              emptyMessage={t(config.emptyKey)}
              emptySubtext={t(config.subtextKey)}
              variant={config.section.variant}
              testIDPrefix={config.section.testIDPrefix}
              mascotVariant={config.mascotVariant}
              mascotCopy={t(config.mascotCopyKey)}
            />
          );
        }

        default:
          return null;
      }
    },
    [
      handleEnableLocation,
      dismissLocationPrompt,
      isLocationLoading,
      searchQuery,
      setSearchQuery,
      filters,
      handleRemoveOfferType,
      handleRemoveEstablishmentType,
      handleRemoveCuisineType,
      handleRemoveCategory,
      handleClearAllFilters,
      openFilters,
      isInitialLoading,
      offerSectionData,
      handleOfferPress,
      handleSeeAll,
      t,
    ],
  );

  /**
   * Extract key for FlatList optimization
   */
  const keyExtractor = useCallback((item: Section) => item.id, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FloatingVoteTab />
      <FlashList<Section>
        ref={flatListRef}
        data={sections}
        renderItem={renderSection}
        keyExtractor={keyExtractor}
        // `sections` only describes WHICH sections exist — the offers themselves
        // live in the `renderSection` closure. FlashList wraps every cell in a
        // PureComponent and only repaints when `data`/`extraData` change identity,
        // so without this the sections stay frozen on their first render and
        // offers arriving from the network are never painted.
        // `renderSection` is the single source of truth for those dependencies
        // (see its useCallback deps), so using it directly keeps the two in sync.
        extraData={renderSection}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            accessibilityLabel={refreshing ? t('home.a11yRefreshing') : t('home.a11yPullRefresh')}
            accessibilityHint={t('home.a11yPullRefreshHint')}
          />
        }
        estimatedItemSize={200}
        accessibilityLabel={t('home.a11yHomeContent')}
        accessibilityHint={t('home.a11yHomeContentHint')}
        testID='home-screen-flatlist'
      />

      {/* Location Selection Modal - First time setup */}
      <LocationSelectionModal
        visible={showLocationSelectionModal}
        onLocationSelect={handleLocationSelectionWrapper}
        isLoading={isLocationLoading}
        error={locationError}
        testID='location-selection-modal'
      />

      {/* Manual Location Modal - Fallback when GPS permission denied */}
      <ManualLocationModal
        visible={showManualLocationModal}
        onClose={closeManualLocationModal}
        onLocationSelect={handleManualLocationSelect}
        testID='manual-location-modal'
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        visible={isFilterVisible}
        filters={filters}
        onClose={() => setIsFilterVisible(false)}
        onApply={handleApplyFilters}
        onClear={handleClearAllFilters}
      />

      {/* Charity Donation Info Bottom Sheet */}
      <CharityDonationBottomSheet
        visible={isCharitySheetVisible}
        onClose={() => setIsCharitySheetVisible(false)}
      />

      {/* Location Picker Bottom Sheet */}
      <LocationPickerBottomSheet
        visible={locationPicker.isVisible}
        currentLocation={manualLocationName}
        recentLocations={recentLocations}
        searchResults={locationPicker.searchResults}
        isLoadingGPS={locationPicker.isLoadingGPS}
        isSearching={locationPicker.isSearching}
        searchQuery={locationPicker.searchQuery}
        onClose={locationPicker.close}
        onUseCurrentLocation={locationPicker.onUseCurrentLocation}
        onSelectLocation={locationPicker.onSelectLocation}
        onSearchChange={locationPicker.onSearchChange}
      />
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  bannerWrapper: {
    paddingHorizontal: 16,
    marginBottom: sp[3],
  },
});
