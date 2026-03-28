/**
 * ManualLocationModal Component
 *
 * Modal for manually searching and selecting a location.
 * Uses Google Places API for address autocomplete.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocationSearch, type GeocodeResult } from '@/features/offers/hooks';

import { useTheme } from '../../../providers';
import { Text, Button, Icon, Input } from '../../atoms';

import type { ManualLocationModalProps, ManualLocationResult } from './ManualLocationModal.types';

export const ManualLocationModal = React.memo<ManualLocationModalProps>(function ManualLocationModal({
  visible,
  onClose,
  onLocationSelect,
  initialQuery = '',
  style,
  testID,
}) {
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

  // Reset query when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }
  }, [visible, initialQuery]);

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
      >
        <Icon
          name='location-outline'
          size={20}
          color={theme.colors.primary}
          style={styles.resultIcon}
        />
        <View style={styles.resultTextContainer}>
          <Text variant='body' size='md' numberOfLines={1}>
            {item.address?.city || item.displayName.split(',')[0]}
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
    [theme.colors, handleSelectLocation],
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
            No locations found for "{debouncedQuery}"
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
              accessibilityLabel='Close'
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
              placeholder='Search city or address...'
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
                  <Pressable onPress={() => setSearchQuery('')}>
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
              accessibilityLabel='Search location'
            />
          </View>

          {/* Results List */}
          <FlatList
            data={searchResults || []}
            keyExtractor={(item, index) =>
              `${item.coordinates.latitude}-${item.coordinates.longitude}-${index}`
            }
            renderItem={renderSearchResult}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps='handled'
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
});

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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listContent: {
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
    marginRight: 8,
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
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    width: '100%',
  },
});

ManualLocationModal.displayName = 'ManualLocationModal';

