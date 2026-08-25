/**
 * SearchResultsDropdown
 *
 * The unified autocomplete panel under the search field: establishments already
 * in the app first, then Google Places. Both lists are capped at 4 so the panel
 * never covers the map.
 *
 * Presentational — all state and selection handling stay in SearchScreen.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { NearbyEstablishment, ProximitySearchResult } from '@/features/offers/hooks';
import type { ILocationResult } from '@/types/location.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/** Both lists are capped so the dropdown cannot cover the whole map. */
const MAX_ITEMS_PER_SECTION = 4;

const SURFACE_SHADOW = '#000';

/** Moved verbatim from SearchScreen — values unchanged, names shortened. */
const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: SURFACE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: sp[3],
    paddingBottom: 8,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginStart: 8,
  },
  empty: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginStart: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: sp[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: sp[3],
  },
  itemText: {
    flex: 1,
    marginEnd: 8,
  },
});

export interface SearchResultsDropdownProps {
  /** Whether the panel is shown at all (field focused / query present). */
  visible: boolean;
  /** A place lookup is in flight. */
  isSearching: boolean;
  /** Debounced query — shown in the empty state. */
  query: string;
  /** Establishments already on the platform. */
  appResults: ProximitySearchResult<NearbyEstablishment>[];
  /** Google Places suggestions. */
  googleResults: ILocationResult[];
  onAppEstablishmentPress: (establishment: ProximitySearchResult<NearbyEstablishment>) => void;
  onGooglePlacePress: (place: ILocationResult) => void;
}

export const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({
  visible,
  isSearching,
  query,
  appResults,
  googleResults,
  onAppEstablishmentPress,
  onGooglePlacePress,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  const hasAny = appResults.length > 0 || googleResults.length > 0;
  const showLoading = isSearching && !hasAny;
  // Only claim "no results" once the search has settled — otherwise the empty
  // state flashes between keystrokes.
  const showEmpty = !isSearching && query.length >= 2 && !hasAny;

  const appShown = appResults.slice(0, MAX_ITEMS_PER_SECTION);
  const googleShown = googleResults.slice(0, MAX_ITEMS_PER_SECTION);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {showLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size='small' color={theme.colors.primary} />
          <Text variant='body' size='sm' color='secondary' style={styles.loadingText}>
            {t('search.searching')}
          </Text>
        </View>
      ) : showEmpty ? (
        <View style={styles.empty}>
          <Text variant='body' size='sm' color='secondary'>
            {t('search.noResultsFor', { query })}
          </Text>
        </View>
      ) : (
        <>
          {appShown.length > 0 && (
            <>
              <Text variant='label' size='xs' color='secondary' style={styles.sectionHeader}>
                {t('search.sectionInApp')}
              </Text>
              {appShown.map((est, index) => (
                <Pressable
                  key={`app-${est.item._id}`}
                  style={[
                    styles.item,
                    { borderBottomColor: theme.colors.outline },
                    // Only the very last row in the panel loses its divider.
                    index === appShown.length - 1 && googleShown.length === 0 && styles.itemLast,
                  ]}
                  onPress={() => onAppEstablishmentPress(est)}
                  accessibilityRole='button'
                  accessibilityLabel={est.item.name}
                  accessibilityHint={t('search.a11ySelectEstablishment', {
                    location: est.item.address?.city ?? est.distance.formatted,
                  })}
                >
                  <View
                    style={[styles.itemIcon, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Icon
                      name='storefront-outline'
                      family='Ionicons'
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.itemText}>
                    <Text variant='body' size='sm' weight='medium' numberOfLines={1}>
                      {est.item.name}
                    </Text>
                    <Text variant='body' size='xs' color='secondary' numberOfLines={1}>
                      {est.item.address?.city ?? est.distance.formatted}
                    </Text>
                  </View>
                  <View
                    style={[styles.sourceBadge, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text variant='label' size='xs' color='primary'>
                      {t('search.sourceApp')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {googleShown.length > 0 && (
            <>
              <Text variant='label' size='xs' color='secondary' style={styles.sectionHeader}>
                {t('search.sectionMorePlaces')}
              </Text>
              {googleShown.map((place, index) => (
                <Pressable
                  key={`google-${place.id}`}
                  style={[
                    styles.item,
                    { borderBottomColor: theme.colors.outline },
                    index === googleShown.length - 1 && styles.itemLast,
                  ]}
                  onPress={() => onGooglePlacePress(place)}
                  accessibilityRole='button'
                  accessibilityLabel={place.name}
                  accessibilityHint={t('search.a11ySelectPlace', { location: place.subtext })}
                >
                  <View style={[styles.itemIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Icon
                      name='location-sharp'
                      family='Ionicons'
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </View>
                  <View style={styles.itemText}>
                    <Text variant='body' size='sm' weight='medium' numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text variant='body' size='xs' color='secondary' numberOfLines={1}>
                      {place.subtext}
                    </Text>
                  </View>
                  <Icon
                    name='arrow-forward'
                    family='Ionicons'
                    size={16}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
};
