/**
 * OfferMarker Component
 *
 * Custom map marker for displaying offers on the map.
 * Features:
 * - Discount percentage badge
 * - Active state with animation
 * - Merchant icon or category icon
 * - Premium look with shadow
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { ProximitySearchResult, NearbyOffer } from '@/features/offers/hooks';

// ============================================================================
// Types
// ============================================================================

interface OfferMarkerProps {
  offer: ProximitySearchResult<NearbyOffer>;
  isSelected: boolean;
  onPress: () => void;
}

// ============================================================================
// Component
// ============================================================================

const OfferMarkerComponent: React.FC<OfferMarkerProps> = ({ offer, isSelected, onPress }) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { item, geoData } = offer;

  // Animate when selected
  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          damping: 10,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          damping: 15,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected, scaleAnim]);

  const discountPercent = Math.round(item.pricing.discountPercentage);

  return (
    <Marker
      coordinate={{
        latitude: geoData.coordinates.latitude,
        longitude: geoData.coordinates.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={isSelected}
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {/* Main Pin */}
        <View
          style={[
            styles.pinBody,
            {
              backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
              borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
            },
          ]}
        >
          {/* Icon or Discount */}
          {discountPercent > 0 ? (
            <Text
              variant='label'
              size='xs'
              weight='bold'
              style={{
                color: isSelected ? theme.colors.onPrimary : theme.colors.primary,
              }}
            >
              -{discountPercent}%
            </Text>
          ) : (
            <Icon
              name='pricetag-outline'
              family='Ionicons'
              size={16}
              color={isSelected ? theme.colors.onPrimary : theme.colors.primary}
            />
          )}
        </View>

        {/* Pin Pointer */}
        <View
          style={[
            styles.pinPointer,
            {
              borderTopColor: isSelected ? theme.colors.primary : theme.colors.background,
            },
          ]}
        />

        {/* Shadow below pin */}
        <View style={styles.pinShadow} />
      </Animated.View>
    </Marker>
  );
};

OfferMarkerComponent.displayName = 'OfferMarker';

export const OfferMarker = React.memo(OfferMarkerComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pinBody: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  pinShadow: {
    width: 16,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    marginTop: 2,
  },
});

