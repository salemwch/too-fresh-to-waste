/**
 * EstablishmentMarker Component
 *
 * Custom map marker for displaying establishments on the map.
 * - Has active offers + food image → food photo circle with green count badge (top-right)
 * - Has active offers + no food image → green circle with count (fallback)
 * - No active offers + merchant profileImage → merchant profile image circle
 * - No active offers + no profileImage → circle with initial letter fallback
 *
 * Animation pattern reused from OfferMarker (spring scale on select).
 *
 * ⚠ SIZING NOTE (react-native-maps):
 *   The Marker takes a native snapshot of the view's measured bounds.
 *   Any content that overflows the measured size is clipped — position:absolute
 *   children do NOT expand the parent's measured size in React Native.
 *   Solution: WRAPPER_W/H are sized to fully contain the circle + badge so the
 *   snapshot captures everything. Badge is at top:0/right:0 (inside, not outside).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, Platform } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { ProximitySearchResult, MapEstablishment } from '@/features/offers/hooks';

// ============================================================================
// Constants
// ============================================================================

const MARKER_SIZE = 44;
const MAX_DISPLAY_COUNT = 5;
const OFFER_BADGE_COLOR = '#2E7D32'; // Material green 800
const BADGE_SIZE = 18;

// Wrapper must be larger than the circle so the badge (top:0/right:0) sits
// at the circle's top-right corner without overflowing outside measured bounds.
const WRAPPER_W = MARKER_SIZE + 10; // 54 — badge extends ~10px past circle right
const WRAPPER_H = MARKER_SIZE + 6;  // 50 — badge extends ~6px above circle top

// ============================================================================
// Types
// ============================================================================

export interface EstablishmentMarkerProps {
  establishment: ProximitySearchResult<MapEstablishment>;
  isSelected: boolean;
  onPress: () => void;
}

// ============================================================================
// Component
// ============================================================================

const EstablishmentMarkerComponent: React.FC<EstablishmentMarkerProps> = ({
  establishment,
  isSelected,
  onPress,
}) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { item, geoData } = establishment;

  // Android: tracksViewChanges must start true so the native layer captures
  // the correct view on first render. After a short delay we switch to false
  // for performance. Without this, the marker snapshot is taken before JS
  // paints the circle → marker appears invisible until tapped.
  const [tracksViewChanges, setTracksViewChanges] = useState(
    Platform.OS === 'android',
  );
  useEffect(() => {
    if (!tracksViewChanges) return;
    const t = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate when selected (same pattern as OfferMarker)
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

  const hasOffers = item.activeOfferCount > 0;
  const foodImage: string | null = item.offers[0]?.images[0] ?? null;
  const displayCount =
    item.activeOfferCount >= MAX_DISPLAY_COUNT
      ? `${MAX_DISPLAY_COUNT}+`
      : String(item.activeOfferCount);
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <Marker
      coordinate={{
        latitude: geoData.coordinates.latitude,
        longitude: geoData.coordinates.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges || isSelected}
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {hasOffers && foodImage ? (
          /*
           * ── Food photo + count badge ──────────────────────────────────
           * Wrapper is WRAPPER_W × WRAPPER_H so both the circle and the
           * badge are fully within the measured bounds (no clipping).
           * Circle is bottom-centre of the wrapper; badge is top-right.
           */
          <View style={styles.badgeWrapper}>
            <View
              style={[
                styles.circle,
                styles.imageCircle,
                { borderColor: isSelected ? OFFER_BADGE_COLOR : theme.colors.outline },
              ]}
            >
              <Image source={{ uri: foodImage }} style={styles.markerImage} />
            </View>
            <View style={styles.countBadge}>
              <Text variant='label' size='xs' weight='bold' style={styles.countBadgeText}>
                {displayCount}
              </Text>
            </View>
          </View>
        ) : hasOffers ? (
          /* ── Fallback: green circle with count (no food image) ─────── */
          <View
            style={[
              styles.circle,
              styles.offerCircle,
              isSelected && styles.selectedBorder,
            ]}
          >
            <Text variant='label' size='sm' weight='bold' style={styles.countText}>
              {displayCount}
            </Text>
          </View>
        ) : item.profileImage ? (
          /* ── Merchant profile image (no active offers) ─────────────── */
          <View
            style={[
              styles.circle,
              styles.imageCircle,
              { borderColor: isSelected ? theme.colors.primary : theme.colors.outline },
            ]}
          >
            <Image
              source={{ uri: item.profileImage }}
              style={styles.markerImage}
            />
          </View>
        ) : (
          /* ── Initial letter fallback ──────────────────────────────── */
          <View
            style={[
              styles.circle,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
              },
            ]}
          >
            <Text
              variant='label'
              size='md'
              weight='bold'
              style={{ color: theme.colors.onPrimaryContainer }}
            >
              {initial}
            </Text>
          </View>
        )}

        {/* Shadow below marker */}
        <View style={styles.markerShadow} />
      </Animated.View>
    </Marker>
  );
};

EstablishmentMarkerComponent.displayName = 'EstablishmentMarker';

export const EstablishmentMarker = React.memo(EstablishmentMarkerComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  /**
   * Explicit WRAPPER_W × WRAPPER_H so the Marker snapshot includes the badge.
   * Circle sits bottom-centre; badge is at top-right (both fully inside bounds).
   */
  badgeWrapper: {
    width: WRAPPER_W,
    height: WRAPPER_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  circle: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  offerCircle: {
    backgroundColor: OFFER_BADGE_COLOR,
    borderColor: OFFER_BADGE_COLOR,
  },
  selectedBorder: {
    borderColor: '#1B5E20',
  },
  imageCircle: {
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  markerImage: {
    width: MARKER_SIZE - 4,
    height: MARKER_SIZE - 4,
    borderRadius: (MARKER_SIZE - 4) / 2,
  },
  /** Sits at top-right of badgeWrapper — fully within measured bounds */
  countBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: OFFER_BADGE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  countBadgeText: {
    color: '#fff',
    lineHeight: BADGE_SIZE,
  },
  countText: {
    color: '#fff',
  },
  markerShadow: {
    width: 16,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    marginTop: 2,
  },
});

export default EstablishmentMarker;
