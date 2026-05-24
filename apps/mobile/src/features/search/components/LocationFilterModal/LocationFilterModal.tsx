/**
 * LocationFilterModal Component
 *
 * Beautiful bottom sheet modal for location filtering.
 * Features:
 * - Continuous distance slider (0.5-30km)
 * - City search with autocomplete
 * - "Use my current location" button
 * - Smooth animations
 */

import { Slider } from '@miblanchard/react-native-slider';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, Icon, Input, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useLocationSearch, type GeocodeResult } from '@/features/offers/hooks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.65;
const BACKDROP = '#000';
const MODAL_SHADOW = '#000';
const THUMB_SHADOW = '#000';

// ============================================================================
// Types
// ============================================================================

interface LocationFilterModalProps {
  visible: boolean;
  onClose: () => void;
  currentRadius: number;
  onRadiusChange: (radius: number) => void;
  onLocationSelect: (location: {
    coordinates: { latitude: number; longitude: number };
    name: string;
  }) => void;
  onUseMyLocation: () => void;
  isLoadingLocation?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const LocationFilterModal: React.FC<LocationFilterModalProps> = ({
  visible,
  onClose,
  currentRadius,
  onRadiusChange,
  onLocationSelect,
  onUseMyLocation,
  isLoadingLocation = false,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const MAX_RADIUS = 15;

  // Local state — clamp to new max in case a persisted value exceeds it
  const [localRadius, setLocalRadius] = useState(Math.min(currentRadius, MAX_RADIUS));
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results
  const { data: searchResults, isLoading: isSearching } = useLocationSearch(
    debouncedQuery.length >= 2 ? debouncedQuery : '',
  );

  // Sync local radius with prop (clamp to max)
  useEffect(() => {
    setLocalRadius(Math.min(currentRadius, MAX_RADIUS));
  }, [currentRadius, MAX_RADIUS]);

  // Animate modal in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: MODAL_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setShowSearchResults(false);
    }
  }, [visible]);

  const handleSliderComplete = useCallback(
    (value: number) => {
      const roundedValue = Math.round(value * 10) / 10;
      onRadiusChange(roundedValue);
    },
    [onRadiusChange],
  );

  const handleLocationSelect = useCallback(
    (result: GeocodeResult) => {
      const cityName = result.address?.city ?? result.displayName.split(',')[0] ?? 'Unknown';
      onLocationSelect({
        coordinates: result.coordinates,
        name: cityName,
      });
      setSearchQuery('');
      setShowSearchResults(false);
      onClose();
    },
    [onLocationSelect, onClose],
  );

  const handleUseMyLocation = useCallback(() => {
    onUseMyLocation();
    onClose();
  }, [onUseMyLocation, onClose]);

  const formatRadius = (value: number): string => {
    if (value < 1) {
      return `${Math.round(value * 1000)} m`;
    }
    return `${value.toFixed(1)} km`;
  };

  const renderSearchResult = useCallback(
    ({ item }: { item: GeocodeResult }) => (
      <Pressable
        accessibilityRole='button'
        style={[styles.searchResultItem, { borderBottomColor: theme.colors.outline }]}
        onPress={() => handleLocationSelect(item)}
      >
        <View style={[styles.searchResultIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name='location-sharp' family='Ionicons' size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.searchResultText}>
          <Text variant='body' size='md' weight='medium' numberOfLines={1}>
            {item.address?.city && item.address.city !== 'Unknown'
              ? item.address.city
              : (item.displayName?.split(',')[0] ?? 'Unknown location')}
          </Text>
          <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
            {item.displayName ?? ''}
          </Text>
        </View>
        <Icon
          name='chevron-forward'
          family='Ionicons'
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>
    ),
    [theme.colors, handleLocationSelect],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback accessibilityRole='button' onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            backgroundColor: theme.colors.background,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text variant='title' size='lg' weight='bold'>
            Location & Distance
          </Text>
          <Pressable
            accessibilityRole='button'
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name='close' family='Ionicons' size={24} color={theme.colors.onSurface} />
          </Pressable>
        </View>

        {/* Distance Slider Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconContainer,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon name='resize' family='Ionicons' size={20} color={theme.colors.primary} />
            </View>
            <Text variant='title' size='md' weight='semibold'>
              Search Radius
            </Text>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderValueContainer}>
              <Text variant='display' size='md' weight='bold' color='primary'>
                {formatRadius(localRadius)}
              </Text>
            </View>

            <Slider
              containerStyle={styles.slider}
              minimumValue={0.5}
              maximumValue={15}
              value={[localRadius]}
              onValueChange={values => setLocalRadius(values[0] ?? localRadius)}
              onSlidingComplete={values => handleSliderComplete(values[0] ?? localRadius)}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.outline}
              thumbTintColor={theme.colors.primary}
              step={0.5}
              trackStyle={styles.sliderTrack}
              thumbStyle={styles.sliderThumb}
            />

            <View style={styles.sliderLabels}>
              <Text variant='label' size='xs' color='secondary' lineHeight={18}>
                500m
              </Text>
              <Text variant='label' size='xs' color='secondary' lineHeight={18}>
                10km
              </Text>
              <Text variant='label' size='xs' color='secondary' lineHeight={18}>
                15km
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* City Search Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconContainer,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon name='search' family='Ionicons' size={20} color={theme.colors.primary} />
            </View>
            <Text variant='title' size='md' weight='semibold'>
              Search City
            </Text>
          </View>

          <Input
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
              setShowSearchResults(true);
            }}
            placeholder='Enter city name...'
            leftIcon='location-outline'
            leftIconFamily='Ionicons'
            rightIcon={searchQuery.length > 0 ? 'close-circle' : ''}
            rightIconFamily='Ionicons'
            onRightIconPress={() => {
              setSearchQuery('');
              setShowSearchResults(false);
            }}
            style={styles.searchInput}
            onFocus={() => setShowSearchResults(true)}
          />

          {/* Search Results */}
          {showSearchResults && searchQuery.length >= 2 && (
            <View style={[styles.searchResults, { backgroundColor: theme.colors.surface }]}>
              {isSearching ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size='small' color={theme.colors.primary} />
                  <Text variant='body' size='sm' color='secondary' style={styles.searchLoadingText}>
                    Searching...
                  </Text>
                </View>
              ) : searchResults && searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.coordinates.latitude}-${index}`}
                  renderItem={renderSearchResult}
                  keyboardShouldPersistTaps='handled'
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                />
              ) : (
                <View style={styles.noResults}>
                  <Text variant='body' size='sm' color='secondary'>
                    No cities found
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* Use My Location Button */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole='button'
            style={[styles.useLocationButton, { backgroundColor: theme.colors.primaryContainer }]}
            onPress={handleUseMyLocation}
            disabled={isLoadingLocation}
          >
            <View style={[styles.useLocationIcon, { backgroundColor: theme.colors.primary }]}>
              {isLoadingLocation ? (
                <ActivityIndicator size='small' color={theme.colors.onPrimary} />
              ) : (
                <Icon name='navigate' family='Ionicons' size={22} color={theme.colors.onPrimary} />
              )}
            </View>
            <View style={styles.useLocationText}>
              <Text variant='title' size='md' weight='semibold'>
                Use My Current Location
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                {isLoadingLocation ? 'Getting location...' : 'Enable GPS to find offers near you'}
              </Text>
            </View>
            <Icon name='chevron-forward' family='Ionicons' size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Apply Button */}
        <View style={styles.footer}>
          <Button variant='primary' size='lg' onPress={onClose} style={styles.applyButton}>
            Apply Filters
          </Button>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: MODAL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: MODAL_SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sliderContainer: {
    paddingHorizontal: 4,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: THUMB_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  searchInput: {
    marginTop: 4,
  },
  searchResults: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
    marginRight: 8,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  searchLoadingText: {
    marginLeft: 8,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  useLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
  },
  useLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  useLocationText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  applyButton: {
    width: '100%',
  },
});
