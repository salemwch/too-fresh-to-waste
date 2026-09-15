/**
 * SkeletonHomeCategoryRail
 *
 * WHEN THIS SHOULD ACTUALLY RENDER
 * --------------------------------
 * Almost never — and that is deliberate.
 *
 * `HomeCategoryRail` has **no data dependency**. Its eight categories come from
 * a frozen module-level array and its artwork is bundled in the APK, so there is
 * no request to wait on. Gating it behind the offer queries, as the home screen
 * briefly did, showed a loading state for something that was never loading and
 * — worse — withheld the filter during exactly the window where applying it
 * early is most useful: a category tapped before the first fetch narrows that
 * fetch instead of forcing a second one.
 *
 * So the rail renders immediately and this component is kept for the one case
 * that is real: a surface that composes the rail with genuinely remote data
 * (live per-category counts, for instance) and must reserve the row's height
 * before that arrives.
 *
 * Its geometry mirrors `HomeCategoryRail` exactly. A skeleton of a different
 * height than the thing it stands in for makes the whole list jump when the
 * real content lands, which is the defect skeletons exist to prevent.
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/** Kept in step with HomeCategoryRail by hand — see the note above. */
const BLOB_SIZE = 88;
const ITEM_WIDTH = 96;
const LABEL_OVERLAP = -16;

/**
 * Four items, not eight: only about four fit on a 390pt screen, so the rest
 * would shimmer off-screen and cost animation work nobody can see.
 *
 * The pill widths are staggered to match the real labels, which are not
 * uniform. A row of identical blocks reads as a progress bar rather than as
 * content about to arrive.
 */
/*
 * Built through StyleSheet.create at module scope: `ShimmerBlock.style` is a
 * plain `ViewStyle`, not a `StyleProp`, so an array is not assignable — and
 * composing one per render would allocate four objects on every shimmer frame.
 */
const pillStyles = StyleSheet.create({
  a: { marginTop: LABEL_OVERLAP, width: 52, height: 22, borderRadius: 11 },
  b: { marginTop: LABEL_OVERLAP, width: 68, height: 22, borderRadius: 11 },
  c: { marginTop: LABEL_OVERLAP, width: 44, height: 22, borderRadius: 11 },
  d: { marginTop: LABEL_OVERLAP, width: 62, height: 22, borderRadius: 11 },
});

const PILLS = Object.freeze([
  { key: 'a', style: pillStyles.a },
  { key: 'b', style: pillStyles.b },
  { key: 'c', style: pillStyles.c },
  { key: 'd', style: pillStyles.d },
]);

interface SkeletonHomeCategoryRailProps {
  testID?: string;
}

const SkeletonHomeCategoryRailComponent = ({
  testID = 'skeleton-home-category-rail',
}: SkeletonHomeCategoryRailProps) => {
  const anim = useShimmerAnimation();

  return (
    <View style={styles.container} testID={testID}>
      {PILLS.map(pill => (
        <View key={pill.key} style={styles.item}>
          {/*
           * A circle, not the blob path. At 88px the difference between a
           * circle and the blob outline is a couple of pixels of silhouette,
           * and rendering an SVG per item to chase it would cost more than it
           * buys on the one frame this is visible.
           */}
          <ShimmerBlock animValue={anim} style={styles.blob} />
          <ShimmerBlock animValue={anim} style={pill.style} />
        </View>
      ))}
    </View>
  );
};

SkeletonHomeCategoryRailComponent.displayName = 'SkeletonHomeCategoryRail';
export const SkeletonHomeCategoryRail = memo(SkeletonHomeCategoryRailComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: sp.sm,
    gap: sp.sm,
    // Clips the trailing item at the screen edge the way the real rail does,
    // instead of letting it force a horizontal overflow.
    overflow: 'hidden',
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  blob: {
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
  },
});
