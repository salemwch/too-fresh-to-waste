/**
 * EstablishmentMarker Component
 *
 * Custom map marker for displaying establishments on the map.
 *
 * Display logic:
 *   - Has active offers  → solid green circle with offer count (1–4 or "5+")
 *   - No offers + profileImage → merchant logo circle (FastImage)
 *   - No offers + no profileImage → initial letter circle (fallback)
 *
 * ⚠ ANDROID react-native-maps RULES:
 *   1. No `elevation` / iOS shadow on any view inside the Marker — shadows are
 *      rendered outside the view's measured bounds and get clipped in the
 *      native snapshot, making the circle look incomplete.
 *   2. `overflow: 'hidden'` does NOT work in Android marker snapshots.
 *      For circular images use FastImage with `borderRadius` on the image
 *      itself — Glide (FastImage's Android renderer) clips natively.
 *   3. Keep the layout flat. Absolute-positioned children outside the
 *      container's measured bounds are clipped in the snapshot.
 *   4. `tracksViewChanges` must start `true` on Android so the snapshot is
 *      retaken after the first JS paint; switch to `false` after 500ms.
 *   5. *** CRITICAL *** The DIRECT child of <Marker> MUST be a plain <View>
 *      with explicit, fixed pixel dimensions — NOT Animated.View.
 *      On Android, react-native-maps snapshots the marker by calling
 *      view.getWidth() / view.getHeight() on the native layer, then draws the
 *      view tree into a bitmap of exactly that size. Animated.View uses
 *      RenderNode-based transforms (GPU compositor) that are bypassed during
 *      draw(canvas). The native layer therefore measures the Animated.View's
 *      pre-animation layout bounds — which, without explicit dimensions, can
 *      settle at an arbitrary small value before JS layout completes. Result:
 *      a bitmap canvas that is fixed at ~30dp regardless of MARKER_SIZE, so
 *      every pixel beyond that is clipped. Clipping is proportional: the
 *      larger MARKER_SIZE, the more that bleeds outside the fixed canvas.
 *      FIX: outer View is plain (React Native measures it via Yoga before
 *      any native-driver transform), inner Animated.View handles animation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Marker } from 'react-native-maps';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { ProximitySearchResult, MapEstablishment } from '@/features/offers/hooks';

// ============================================================================
// Constants
// ============================================================================

const MARKER_SIZE = 48;
const MAX_DISPLAY_COUNT = 5;
const OFFER_CIRCLE_COLOR = '#2E7D32'; // Material green 800

/**
 * Extra space around the circle so the border + anti-aliasing never touch the
 * bitmap edge, AND there is headroom for the 1.2× selection scale peak.
 *
 * Required headroom for 1.2× scale: (MARKER_SIZE × 0.2) / 2 = 4.8dp → 5dp
 * Extra safety margin: 5dp
 * Total: 10dp on each side
 */
const CONTAINER_PADDING = 10;

const SHADOW_WIDTH = 20;
const SHADOW_HEIGHT = 6;
const SHADOW_MARGIN_TOP = 4;

/**
 * Fixed outer container dimensions — the snapshot canvas is sized to these.
 * Must be large enough to contain the circle at its peak selected scale (1.2×).
 *
 * Width:  MARKER_SIZE × 1.2 + 2 × safety  = 57.6 + (68 - 57.6) ✓
 * Height: (MARKER_SIZE + SHADOW_MARGIN + SHADOW_HEIGHT) × 1.2 + safety ✓
 */
const CONTAINER_WIDTH = MARKER_SIZE + CONTAINER_PADDING * 2;  // 68
const CONTAINER_HEIGHT = MARKER_SIZE + SHADOW_MARGIN_TOP + SHADOW_HEIGHT + CONTAINER_PADDING * 2; // 78

// ============================================================================
// Types
// ============================================================================

interface EstablishmentMarkerProps {
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
  const [tracksViewChanges, setTracksViewChanges] = useState(Platform.OS === 'android');
  useEffect(() => {
    if (!tracksViewChanges) return;
    const t = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate scale on selection
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
      {/*
       * ⚠ ANDROID: plain <View> here — NOT Animated.View.
       *   Fixed CONTAINER_WIDTH × CONTAINER_HEIGHT gives the native layer exact
       *   snapshot canvas dimensions before any JS animation runs.
       *   The Animated.View is one level inward so transforms never affect the
       *   canvas measurement.
       */}
      <View style={styles.container}>
        <Animated.View style={[styles.animatedContent, { transform: [{ scale: scaleAnim }] }]}>
          {hasOffers ? (
            /* ── Green circle with offer count ─────────────────────────── */
            <View
              style={[styles.circle, styles.offerCircle, isSelected && styles.selectedOfferBorder]}
            >
              <Text variant='label' size='sm' weight='bold' style={styles.countText}>
                {displayCount}
              </Text>
            </View>
          ) : item.profileImage != null ? (
            /* ── Merchant logo (FastImage — handles borderRadius on Android) */
            <View
              style={[
                styles.circle,
                styles.imageCircle,
                { borderColor: isSelected ? theme.colors.primary : '#e0e0e0' },
              ]}
            >
              <FastImage
                source={{ uri: item.profileImage, priority: FastImage.priority.normal }}
                style={styles.profileImage}
              />
            </View>
          ) : (
            /* ── Initial letter fallback ──────────────────────────────── */
            <View
              style={[
                styles.circle,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: isSelected ? theme.colors.primary : '#e0e0e0',
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

          {/* Small oval shadow below — visual depth without elevation */}
          <View style={styles.markerShadow} />
        </Animated.View>
      </View>
    </Marker>
  );
};

EstablishmentMarkerComponent.displayName = 'EstablishmentMarker';

export const EstablishmentMarker = React.memo(EstablishmentMarkerComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  /**
   * FIXED outer bounds — sized to CONTAINER_WIDTH × CONTAINER_HEIGHT so the
   * Android native layer always gets the correct bitmap canvas dimensions.
   * This must be a plain View style (applied to a plain <View>), never to an
   * Animated.View, to avoid the RenderNode snapshot measurement bug.
   */
  container: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: CONTAINER_PADDING,
  },
  /**
   * Inner animated wrapper — scale transforms run here, inside the fixed
   * canvas, so nothing ever bleeds outside the snapshot bounds.
   */
  animatedContent: {
    alignItems: 'center',
  },
  circle: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    // ⚠ No elevation / shadowColor here — see file-level comment.
  },
  offerCircle: {
    backgroundColor: OFFER_CIRCLE_COLOR,
    borderColor: '#fff', // white ring separates green from any map tile colour
  },
  selectedOfferBorder: {
    borderColor: '#B9F6CA', // light green ring when selected
  },
  /**
   * Image circle: white background visible while FastImage loads.
   * overflow is intentionally NOT set — `overflow: 'hidden'` does not work
   * in react-native-maps Android snapshots. FastImage clips via borderRadius.
   */
  imageCircle: {
    backgroundColor: '#fff',
  },
  /**
   * FastImage clips to borderRadius natively on Android (Glide).
   * Inset by border width (2.5) + 0.5dp safety = 3dp total breathing room.
   */
  profileImage: {
    width: MARKER_SIZE - 6,
    height: MARKER_SIZE - 6,
    borderRadius: (MARKER_SIZE - 6) / 2,
  },
  countText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  /** Soft oval shadow — replaces elevation so no snapshot clipping occurs. */
  markerShadow: {
    width: SHADOW_WIDTH,
    height: SHADOW_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: SHADOW_HEIGHT / 2,
    marginTop: SHADOW_MARGIN_TOP,
  },
});

