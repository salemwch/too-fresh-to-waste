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

import React, { memo, useEffect, useRef, useState } from 'react';
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
const MARKER_BORDER = '#e0e0e0';
const WHITE = '#fff';
const SELECTED_OFFER_BORDER = '#B9F6CA';
const MARKER_SHADOW = 'rgba(0,0,0,0.18)';

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
const CONTAINER_WIDTH = MARKER_SIZE + CONTAINER_PADDING * 2; // 68
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
  const markerBorderStyle = { borderColor: isSelected ? theme.colors.primary : MARKER_BORDER };

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Android: tracksViewChanges must start true so the native layer captures
  // the correct view on first render. Keep it true until the profile image
  // has loaded (or errored/absent) so the snapshot includes the actual image,
  // with a max-timeout fallback to avoid indefinite re-renders.
  const [tracksViewChanges, setTracksViewChanges] = useState(Platform.OS === 'android');
  const profileImageUri = item.profileImage?.trim() || null;
  const hasProfileUrl = profileImageUri !== null;

  useEffect(() => {
    if (!tracksViewChanges) return;
    // If no image to wait for, stop tracking after initial paint
    const delay = hasProfileUrl ? 4000 : 800;
    const t = setTimeout(() => setTracksViewChanges(false), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reSnapshot = () => {
    if (Platform.OS === 'android') {
      setTracksViewChanges(true);
      setTimeout(() => setTracksViewChanges(false), 600);
    }
  };
  const handleImageError = () => {
    setImageError(true);
    reSnapshot();
  };
  const handleImageLoad = () => {
    setImageLoaded(true);
    reSnapshot();
  };

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
  // Show profile image only once actually loaded — until then, show the
  // count/initial fallback so the marker is never an empty circle.
  const showProfileImage = hasProfileUrl && !imageError;
  const imageReady = showProfileImage && imageLoaded;

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
          {/* ── Base circle: profile image with initial letter fallback ── */}
          <View
            style={[
              styles.circle,
              hasOffers
                ? imageReady
                  ? [styles.offerImageBorder, isSelected && styles.selectedOfferBorder]
                  : [styles.offerCircle, isSelected && styles.selectedOfferBorder]
                : [{ backgroundColor: theme.colors.primaryContainer }, markerBorderStyle],
            ]}
          >
            {/* Fallback text: count (offers) or initial (no offers).
                Shown while the image loads so the marker is never empty. */}
            {(!imageReady || !hasOffers) && (
              <Text
                variant='label'
                size={hasOffers ? 'sm' : 'md'}
                weight='bold'
                style={hasOffers ? styles.countText : { color: theme.colors.onPrimaryContainer }}
              >
                {hasOffers ? displayCount : initial}
              </Text>
            )}
            {/* Always mount FastImage when URL exists so it starts loading.
                It only becomes visible once imageReady flips true. */}
            {showProfileImage && (
              <FastImage
                source={{ uri: profileImageUri!, priority: FastImage.priority.high }}
                style={[styles.profileImageOverlay, !imageReady && styles.hiddenImage]}
                onError={handleImageError}
                onLoad={handleImageLoad}
                accessibilityIgnoresInvertColors
              />
            )}
            {hasOffers && imageReady && (
              <View style={styles.offerBadge}>
                <Text variant='label' size='xs' weight='bold' style={styles.badgeText}>
                  {displayCount}
                </Text>
              </View>
            )}
          </View>

          {/* Small oval shadow below — visual depth without elevation */}
          <View style={styles.markerShadow} />
        </Animated.View>
      </View>
    </Marker>
  );
};

EstablishmentMarkerComponent.displayName = 'EstablishmentMarker';

export const EstablishmentMarker = memo(EstablishmentMarkerComponent);

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
    borderColor: WHITE,
  },
  offerImageBorder: {
    borderColor: OFFER_CIRCLE_COLOR,
  },
  selectedOfferBorder: {
    borderColor: SELECTED_OFFER_BORDER,
  },
  /**
   * FastImage overlaid on top of the initial-letter circle.
   * Fills the circle exactly; Glide clips to borderRadius natively on Android.
   * overflow:hidden is NOT used — doesn't work in react-native-maps snapshots.
   */
  profileImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: MARKER_SIZE / 2,
  },
  hiddenImage: {
    opacity: 0,
  },
  countText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  offerBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: OFFER_CIRCLE_COLOR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  badgeText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  /** Soft oval shadow — replaces elevation so no snapshot clipping occurs. */
  markerShadow: {
    width: SHADOW_WIDTH,
    height: SHADOW_HEIGHT,
    backgroundColor: MARKER_SHADOW,
    borderRadius: SHADOW_HEIGHT / 2,
    marginTop: SHADOW_MARGIN_TOP,
  },
});
