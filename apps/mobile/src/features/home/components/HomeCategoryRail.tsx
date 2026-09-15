/**
 * HomeCategoryRail
 *
 * A single horizontal row of establishment-category shortcuts, rendered
 * directly beneath the search bar. Tapping a tile filters the offer carousels
 * in place — no navigation, no bottom sheet, no Apply step.
 *
 * ── Organic blob, not a squircle ────────────────────────────────────────────
 * The container is a hand-authored blob path rather than a rounded rectangle.
 * `borderRadius` cannot express an asymmetric organic outline, so the shape is
 * drawn with `react-native-svg` and the artwork is centred on top of it.
 *
 * The blob is **white**, so it carries no category colour of its own — the
 * artwork is the only thing distinguishing one tile from the next, and it is
 * sized to fill 66% of the shape to earn that job.
 *
 * ── Selection lives on the outline ──────────────────────────────────────────
 * With a white fill there is no background left to tint, so the selected state
 * is a stroke on the blob path in the category's own accent, plus a bolder
 * label. The stroke follows the organic outline, which a border on a `View`
 * could never do.
 *
 * The artwork is **never** recoloured in either state — see DESIGN.md §19-E34.
 *
 * ── RTL ─────────────────────────────────────────────────────────────────────
 * The data order is **never** reversed here. `I18nManager.forceRTL` flips row
 * layout natively (see `src/i18n/index.ts`), so a horizontal row already lays
 * out right-to-left in Arabic. Reversing the array as well would flip it twice
 * and land back in left-to-right order — the classic RTL carousel bug, which is
 * why the order is asserted in the tests rather than left as a comment.
 *
 * Padding is symmetric (`paddingHorizontal`) for the same reason.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { establishmentCategoryChrome as chrome } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import {
  ESTABLISHMENT_CATEGORIES,
  isCategoryActive,
} from '@/features/offers/constants/establishmentCategories';

import type {
  EstablishmentCategory,
  EstablishmentCategoryId,
} from '@/features/offers/constants/establishmentCategories';
import type { EstablishmentType } from '@/features/offers/types/offer.types';
import type { StyleProp, TextStyle } from 'react-native';

const { base: sp } = spacingTokens;

/**
 * The blob outline, on a 100x100 viewBox rendered into a -4..104 one so the
 * selected stroke is not clipped where the path runs to the edge.
 *
 * Generated from six radii (50, 46, 48, 43, 47, 49) sampled at even angles and
 * smoothed with Catmull-Rom, so the curve is continuous and there are no
 * corners where segments meet. That spread — roughly ±7% — is the setting that
 * reads as organic rather than as a circle: eight sample points at ±5% smoothed
 * back into a circle, and five points at ±15% produced teardrops.
 *
 * One shared path for every category on purpose: eight different blobs would
 * read as eight unrelated stickers rather than one row of controls.
 */
const BLOB_PATH =
  'M50.0 0.0C61.9 -0.1 78.2 11.2 86.0 21.3C93.8 31.4 99.7 49.4 96.8 60.7C93.9 71.9 79.9 83.5 68.7 88.7C57.5 94.0 40.7 97.0 29.6 92.3C18.5 87.7 4.7 72.6 2.2 60.9C-0.2 49.2 6.9 32.1 14.8 21.9C22.8 11.8 38.1 0.1 50.0 0.0Z';

/** Blob 88px, artwork 60px — the artwork fills 68% of the shape. */
const BLOB_SIZE = 88;
const ICON_SIZE = 60;
/** Wide enough for "Supermarket" and "Wholesaler" without truncating. */
const ITEM_WIDTH = 96;
/**
 * How far the label pill rides up over the blob's bottom edge.
 *
 * The pill overlapping the shape is what ties the two into one object; a label
 * floating below reads as a caption for a separate picture. Negative margin
 * rather than absolute positioning so the pill still contributes its own height
 * to the row — two-line labels ("Supermarket") must push the row taller, not
 * overflow it.
 */
const LABEL_OVERLAP = -16;
/** Selected outline weight, in viewBox units (100 units = BLOB_SIZE px). */
const STROKE_W = 4;

const BLOB_SHADOW = 'rgba(15, 34, 37, 0.07)';
const BLOB_FILL = chrome.surface;

// ============================================================================
// Types
// ============================================================================

interface HomeCategoryRailProps {
  /** Raw `filters.establishmentTypes`. Drives which tiles read as selected. */
  selectedTypes: readonly EstablishmentType[];
  /** Toggle a whole category on or off. Must be referentially stable. */
  onToggleCategory: (id: EstablishmentCategoryId) => void;
  testID?: string;
}

interface CategoryTileProps {
  category: EstablishmentCategory;
  isSelected: boolean;
  onToggle: (id: EstablishmentCategoryId) => void;
  labelStyle: StyleProp<TextStyle>;
}

// ============================================================================
// Tile
// ============================================================================

/**
 * One category tile.
 *
 * Takes `onToggle` plus its own `category` rather than a pre-bound
 * `() => onToggle(id)`. A bound closure would be a fresh function identity on
 * every parent render, which would defeat the `memo` below and repaint all
 * eight tiles whenever one of them changed.
 */
const CategoryTileComponent = ({
  category,
  isSelected,
  onToggle,
  labelStyle,
}: CategoryTileProps) => {
  const { t } = useTranslation();
  const { artwork, id, labelKey, accent } = category;

  const handlePress = useCallback(() => {
    onToggle(id);
  }, [onToggle, id]);

  const selectedLabel = useMemo(
    () => [styles.label, styles.labelSelected, { color: accent }],
    [accent],
  );

  const selectedPill = useMemo(() => [styles.pill, { borderColor: accent }], [accent]);

  const label = t(labelKey);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.item}
      accessibilityRole='button'
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(
        isSelected ? 'establishmentCategories.a11yClear' : 'establishmentCategories.a11ySelect',
        { category: label },
      )}
      accessibilityHint={t('establishmentCategories.a11yHint')}
      testID={`home-category-chip-${id}`}
    >
      <View style={styles.blobWrap} testID={`home-category-tile-${id}`}>
        <Svg
          width={BLOB_SIZE}
          height={BLOB_SIZE}
          viewBox='-4 -4 108 108'
          style={StyleSheet.absoluteFill}
        >
          {/*
           * A second copy of the path nudged down and drawn flat, rather than
           * an Android `elevation`. Rule 11 in `.claude/rules/mobile.md`:
           * elevation on a rounded, clipped view renders a rectangular shadow
           * outline — here that would be the shadow of a square sitting behind
           * an organic shape.
           */}
          <G y={2.5}>
            <Path d={BLOB_PATH} fill={BLOB_SHADOW} />
          </G>
          <Path
            d={BLOB_PATH}
            fill={BLOB_FILL}
            testID={`home-category-blob-${id}`}
            {...(isSelected ? { stroke: accent, strokeWidth: STROKE_W } : {})}
          />
        </Svg>

        {/*
         * No `color`/`tintColor` on either branch: the artwork ships its own
         * palette and keeps it in both states. Selection is carried by the blob
         * outline, never by the icon — DESIGN.md §19-E34.
         */}
        {artwork.kind === 'vector' ? (
          <artwork.Icon width={ICON_SIZE} height={ICON_SIZE} testID='category-artwork' />
        ) : (
          <Image
            source={artwork.source}
            style={styles.raster}
            resizeMode='contain'
            testID='category-artwork'
            // iOS Smart Invert would invert the artwork and destroy its palette,
            // which is the one thing this icon set exists to preserve.
            accessibilityIgnoresInvertColors
            // The artwork illustrates the label; it carries nothing the label
            // does not already say.
            accessibilityElementsHidden
            importantForAccessibility='no'
          />
        )}
      </View>

      {/*
       * Rendered after the blob so it paints on top of it — RN has no z-index
       * ordering here beyond sibling order.
       */}
      <View style={isSelected ? selectedPill : styles.pill}>
        <Text style={isSelected ? selectedLabel : labelStyle} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

CategoryTileComponent.displayName = 'CategoryTile';

const CategoryTile = memo(CategoryTileComponent);

// ============================================================================
// Rail
// ============================================================================

const HomeCategoryRailComponent = ({
  selectedTypes,
  onToggleCategory,
  testID = 'home-category-rail',
}: HomeCategoryRailProps) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  /** One object for all eight idle labels, not one per tile per render. */
  const idleLabelStyle = useMemo(
    () => [styles.label, { color: colors.onSurfaceVariant }],
    [colors.onSurfaceVariant],
  );

  return (
    <View style={styles.container} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        accessibilityLabel={t('establishmentCategories.railLabel')}
        accessibilityHint={t('establishmentCategories.a11yRailHint')}
        testID={`${testID}-scroll`}
      >
        {/*
         * Canonical order, always. RN flips the row itself under RTL — see the
         * file header. Do not `.slice().reverse()` this for Arabic.
         */}
        {ESTABLISHMENT_CATEGORIES.map(category => (
          <CategoryTile
            key={category.id}
            category={category}
            isSelected={isCategoryActive(selectedTypes, category.id)}
            onToggle={onToggleCategory}
            labelStyle={idleLabelStyle}
          />
        ))}
      </ScrollView>
    </View>
  );
};

HomeCategoryRailComponent.displayName = 'HomeCategoryRail';

export const HomeCategoryRail = memo(HomeCategoryRailComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingBottom: sp.sm,
  },
  content: {
    // Symmetric on purpose — see the RTL note in the file header.
    paddingHorizontal: 16,
    gap: sp.sm,
    alignItems: 'flex-start',
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  blobWrap: {
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raster: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  pill: {
    marginTop: LABEL_OVERLAP,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: chrome.surface,
    borderWidth: 1.5,
    borderColor: chrome.pillBorder,
    maxWidth: ITEM_WIDTH,
    alignItems: 'center',
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelSelected: {
    fontWeight: '800',
  },
});
