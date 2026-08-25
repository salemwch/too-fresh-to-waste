/**
 * ManualLocationModal Component
 *
 * Modal for manually searching and selecting a location.
 * Uses Google Places API for address autocomplete.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocationSearch, type GeocodeResult } from '@/features/offers/hooks';

import { useTheme } from '../../../providers';
import { Text, Button, Icon, Input } from '../../atoms';

import type { ManualLocationModalProps, ManualLocationResult } from './ManualLocationModal.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

export const ManualLocationModal = memo<ManualLocationModalProps>(
  ({ visible, onClose, onLocationSelect, initialQuery = '', style, testID }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

    // Debounce search query
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedQuery(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleModalShow = useCallback(() => {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }, [initialQuery]);

    // Fetch search results
    const { data: searchResults, isLoading, error } = useLocationSearch(debouncedQuery);

    const handleSelectLocation = useCallback(
      (result: GeocodeResult) => {
        const location: ManualLocationResult = {
          coordinates: result.coordinates,
          name: result.displayName,
        };
        onLocationSelect(location);
        onClose();
      },
      [onLocationSelect, onClose],
    );

    const renderSearchResult = useCallback(
      ({ item }: { item: GeocodeResult }) => (
        <Pressable
          style={[styles.resultItem, { borderBottomColor: theme.colors.outline }]}
          onPress={() => handleSelectLocation(item)}
          accessibilityRole='button'
          accessibilityLabel={item.displayName}
          accessibilityHint={t('location.a11ySetAsLocationHint')}
        >
          <Icon
            name='location-outline'
            size={20}
            color={theme.colors.primary}
            style={styles.resultIcon}
          />
          <View style={styles.resultTextContainer}>
            <Text variant='body' size='md' numberOfLines={1}>
              {item.address?.city ?? item.displayName.split(',')[0]}
            </Text>
            <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
              {item.displayName}
            </Text>
          </View>
          <Icon
            name='chevron-forward'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      ),
      [theme.colors, handleSelectLocation, t],
    );

    const renderEmptyState = useCallback(() => {
      if (isLoading) {
        return (
          <View style={styles.emptyState}>
            <ActivityIndicator size='large' color={theme.colors.primary} />
            <Text variant='body' size='md' color='secondary' style={styles.emptyText}>
              Searching locations...
            </Text>
          </View>
        );
      }

      if (error) {
        return (
          <View style={styles.emptyState}>
            <Icon
              name='alert-circle-outline'
              family='Ionicons'
              size={48}
              color={theme.colors.error}
            />
            <Text variant='body' size='md' color='secondary' style={styles.emptyText}>
              Failed to search locations. Please try again.
            </Text>
          </View>
        );
      }

      if (debouncedQuery.length >= 3 && (!searchResults || searchResults.length === 0)) {
        return (
          <View style={styles.emptyState}>
            <Icon
              name='search-outline'
              family='Ionicons'
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant='body' size='md' color='secondary' style={styles.emptyText}>
              No locations found for &ldquo;{debouncedQuery}&rdquo;
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.emptyState}>
          <Icon
            name='location-sharp'
            family='Ionicons'
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant='body' size='md' color='secondary' style={styles.emptyText}>
            Search for a city, address, or place
          </Text>
        </View>
      );
    }, [isLoading, error, debouncedQuery, searchResults, theme.colors]);

    return (
      <Modal
        visible={visible}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={onClose}
        onShow={handleModalShow}
        testID={testID}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.colors.background }, style]}
          edges={['top']}
        >
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
              <Text variant='title' size='lg' weight='semibold'>
                Set Location
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={t('common.close')}
                accessibilityHint={t('location.a11yCloseHint')}
                accessibilityRole='button'
              >
                <Icon name='close' family='Ionicons' size={24} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('location.searchCityOrAddress')}
                leftIcon={
                  <Icon
                    name='search'
                    family='Ionicons'
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                }
                rightIcon={
                  searchQuery.length > 0 ? (
                    <Pressable accessibilityRole='button' onPress={() => setSearchQuery('')}>
                      <Icon
                        name='close-circle'
                        family='Ionicons'
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </Pressable>
                  ) : undefined
                }
                autoFocus
                returnKeyType='search'
                accessibilityLabel={t('location.a11ySearchLocation')}
                accessibilityHint={t('location.a11ySearchLocationHint')}
              />
            </View>

            {/* Results List */}
            <FlashList
              data={searchResults ?? []}
              keyExtractor={(item, index) =>
                `${item.coordinates.latitude}-${item.coordinates.longitude}-${index}`
              }
              renderItem={renderSearchResult}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps='handled'
              estimatedItemSize={56}
            />

            {/* Cancel Button */}
            <View style={[styles.footer, { borderTopColor: theme.colors.outline }]}>
              <Button variant='outline' size='lg' onPress={onClose} style={styles.cancelButton}>
                Cancel
              </Button>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: sp[3],
    borderBottomWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: sp[3],
  },
  listContent: {
    paddingBottom: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: sp[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    marginEnd: sp[3],
  },
  resultTextContainer: {
    flex: 1,
    marginEnd: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: sp[3],
    borderTopWidth: 1,
  },
  cancelButton: {
    width: '100%',
  },
});

ManualLocationModal.displayName = 'ManualLocationModal';
