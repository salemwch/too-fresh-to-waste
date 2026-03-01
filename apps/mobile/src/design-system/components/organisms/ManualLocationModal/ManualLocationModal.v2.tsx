/**
 * ManualLocationModal Component (V2 - Hybrid Search)
 *
 * Modal for manually searching and selecting a location.
 * Uses hybrid local-first search strategy:
 * - Primary: Local tunisian-cities.json
 * - Fallback: Google Places API (via backend proxy)
 *
 * Features:
 * - Highlighted search matches
 * - Arabic language support (based on device locale)
 * - Clean error states
 * - Debounced search (300ms)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocationSearch, type ILocationResult } from '@/features/offers/hooks/useGeocode.v2';
import { highlightMatch } from '@/utils/location/textHighlighter';

import { useTheme } from '../../../providers';
import { Text, Icon, Input } from '../../atoms';

import type { ManualLocationModalProps, ManualLocationResult } from './ManualLocationModal.types';

export const ManualLocationModalV2: React.FC<ManualLocationModalProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialQuery = '',
  style: _style,
  testID = 'manual-location-modal-v2',
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  // Determine if user prefers Arabic based on device locale
  // Uses React Native's NativeModules to detect locale without requiring react-i18next
  const deviceLocale =
    (NativeModules['SettingsManager']?.settings?.AppleLocale as string | undefined) ??
    (NativeModules['I18nManager']?.localeIdentifier as string | undefined) ??
    '';
  const isArabicLocale = deviceLocale.startsWith('ar');

  // Reset query when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  // Track whether we're resolving a Google Place selection
  const [isResolving, setIsResolving] = useState(false);

  // Fetch search results using hybrid search with session token optimization
  const {
    data: searchResults,
    isLoading,
    error,
    resolveGooglePlace,
    resetSessionToken,
  } = useLocationSearch(searchQuery, {
    debounceDelay: 300,
    minLength: 2,
    maxResults: 10,
  });

  // Reset session token when modal closes without selection
  useEffect(() => {
    if (!visible) {
      resetSessionToken();
    }
  }, [visible, resetSessionToken]);

  const handleSelectLocation = useCallback(
    async (result: ILocationResult) => {
      let coords = result.coords;

      // For GOOGLE results, fetch real coordinates via Place Details
      // This concludes the session token billing session
      if (result.googlePlaceId) {
        setIsResolving(true);
        try {
          const resolved = await resolveGooglePlace(result.googlePlaceId);
          if (resolved) {
            coords = resolved.coords;
          } else {
            setIsResolving(false);
            return; // Failed to resolve - don't select
          }
        } finally {
          setIsResolving(false);
        }
      }

      const location: ManualLocationResult = {
        coordinates: {
          latitude: coords.lat,
          longitude: coords.lng,
        },
        name: isArabicLocale ? result.nameAr : result.name,
      };
      onLocationSelect(location);
      onClose();
      setSearchQuery('');
    },
    [onLocationSelect, onClose, isArabicLocale, resolveGooglePlace],
  );

  const renderSearchResult = useCallback(
    ({ item }: { item: ILocationResult }) => {
      // Choose display name based on locale
      const displayName = isArabicLocale ? item.nameAr : item.name;
      const displaySubtext = item.subtext;

      // Highlight matched text in name
      const highlightedParts = highlightMatch(displayName, searchQuery);

      return (
        <Pressable
          style={[styles.resultItem, { borderBottomColor: theme.colors.outline }]}
          onPress={() => handleSelectLocation(item)}
          accessibilityRole='button'
          accessibilityLabel={displayName}
        >
          <Icon
            name='location-outline'
            size={20}
            color={theme.colors.primary}
            style={styles.resultIcon}
          />
          <View style={styles.resultTextContainer}>
            {/* Highlighted name */}
            <Text variant='body' size='md' numberOfLines={1}>
              {highlightedParts.map((part, index) => (
                <Text
                  key={index}
                  variant='body'
                  size='md'
                  weight={part.highlight ? 'bold' : 'regular'}
                >
                  {part.text}
                </Text>
              ))}
            </Text>
            {/* Subtext (delegation, city, country) */}
            <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
              {displaySubtext}
            </Text>
            {/* Source badge (LOCAL or GOOGLE) */}
            {item.source === 'LOCAL' && (
              <View style={[styles.sourceBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text variant='body' size='xs' color='onPrimaryContainer'>
                  Local
                </Text>
              </View>
            )}
          </View>
          <Icon
            name='chevron-forward'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      );
    },
    [searchQuery, theme, handleSelectLocation, isArabicLocale],
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return null;
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Icon
            name='alert-circle-outline'
            size={48}
            color={theme.colors.error}
            style={styles.emptyIcon}
          />
          <Text variant='body' size='md' color='error' align='center'>
            Failed to search locations
          </Text>
          <Text variant='body' size='sm' color='secondary' align='center'>
            Please check your connection and try again
          </Text>
        </View>
      );
    }

    if (searchQuery.length >= 2 && (!searchResults || searchResults.length === 0)) {
      return (
        <View style={styles.emptyState}>
          <Icon
            name='search-outline'
            size={48}
            color={theme.colors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text variant='body' size='md' color='secondary' align='center'>
            No locations found
          </Text>
          <Text variant='body' size='sm' color='secondary' align='center'>
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Icon
          name='location-outline'
          size={48}
          color={theme.colors.onSurfaceVariant}
          style={styles.emptyIcon}
        />
        <Text variant='body' size='md' color='secondary' align='center'>
          Search for a city or area
        </Text>
      </View>
    );
  }, [isLoading, error, searchQuery, searchResults, theme]);

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole='button'
              accessibilityLabel='Close'
            >
              <Icon name='close' size={24} color={theme.colors.onSurface} />
            </Pressable>
            <Text variant='headline' size='lg'>
              Select Location
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Input
              placeholder='Search city or area...'
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon={
                <Icon name='search-outline' size={20} color={theme.colors.onSurfaceVariant} />
              }
              rightIcon={
                searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Icon name='close-circle' size={20} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                ) : undefined
              }
              autoFocus
              autoCapitalize='words'
              autoCorrect={false}
              testID={`${testID}-search-input`}
            />
          </View>

          {/* Loading Indicator */}
          {(isLoading || isResolving) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='small' color={theme.colors.primary} />
              <Text variant='body' size='sm' color='secondary' style={styles.loadingText}>
                {isResolving ? 'Loading location...' : 'Searching...'}
              </Text>
            </View>
          )}

          {/* Search Results */}
          <FlatList
            data={searchResults || []}
            renderItem={renderSearchResult}
            keyExtractor={item => item.id}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            ListEmptyComponent={renderEmptyState}
            keyboardShouldPersistTaps='handled'
            testID={`${testID}-results-list`}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
    position: 'relative',
  },
  sourceBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
});
