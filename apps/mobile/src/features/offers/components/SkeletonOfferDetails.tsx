/**
 * Skeleton Offer Details Component
 *
 * Loading skeleton for OfferDetailsScreen
 * Mimics the layout of the actual offer details for better UX
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { SkeletonBase } from '@/components/Loading/SkeletonBase';

const SURFACE = '#fff';
const SURFACE_MUTED = '#f3f4f6';
const SURFACE_SUBTLE = '#f9fafb';
const BORDER = '#e5e7eb';
const SHADOW = '#000';

export const SkeletonOfferDetails: React.FC = () => (
  <View style={styles.container}>
    {/* Header Image Skeleton */}
    <View style={styles.headerImageContainer}>
      <SkeletonBase width='100%' height={280} borderRadius={0} />

      {/* Merchant Logo Skeleton */}
      <View style={styles.merchantLogoPosition}>
        <SkeletonBase width={56} height={56} borderRadius={28} />
      </View>

      {/* Header Text Skeleton */}
      <View style={styles.headerTextPosition}>
        <SkeletonBase width={180} height={20} borderRadius={4} style={styles.headerTitleSpacing} />
        <SkeletonBase width={120} height={14} borderRadius={4} />
      </View>
    </View>

    {/* Content Section */}
    <View style={styles.contentContainer}>
      {/* Offer Type and Price Row */}
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleRow}>
          <SkeletonBase width={20} height={20} borderRadius={4} />
          <SkeletonBase width={120} height={18} borderRadius={4} style={styles.itemTitleSpacing} />
        </View>
        <View style={styles.priceRow}>
          <SkeletonBase width={70} height={16} borderRadius={4} style={styles.priceSpacing} />
          <SkeletonBase width={80} height={22} borderRadius={4} />
        </View>
      </View>

      {/* Rating Skeleton */}
      <View style={styles.ratingRow}>
        <SkeletonBase width={16} height={16} borderRadius={4} />
        <SkeletonBase width={40} height={16} borderRadius={4} style={styles.inlineGap6} />
        <SkeletonBase width={50} height={16} borderRadius={4} style={styles.inlineGap6} />
      </View>

      {/* Pickup Time Row */}
      <View style={styles.pickupRow}>
        <SkeletonBase width={20} height={20} borderRadius={4} />
        <SkeletonBase width={200} height={16} borderRadius={4} style={styles.inlineGap8} />
        <SkeletonBase width={60} height={20} borderRadius={4} style={styles.inlineGap8} />
      </View>

      {/* Location Card Skeleton */}
      <View style={styles.locationCard}>
        <View style={styles.locationContent}>
          <SkeletonBase width={32} height={32} borderRadius={16} />
          <View style={styles.locationDetails}>
            <SkeletonBase width='80%' height={16} borderRadius={4} style={styles.blockGap6} />
            <SkeletonBase width='60%' height={14} borderRadius={4} />
          </View>
        </View>
        <SkeletonBase width={20} height={20} borderRadius={4} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Description Section Skeleton */}
      <View style={styles.section}>
        <View style={styles.accordionHeader}>
          <SkeletonBase width={140} height={18} borderRadius={4} />
          <SkeletonBase width={20} height={20} borderRadius={4} />
        </View>
        <View style={styles.accordionContent}>
          <SkeletonBase width='100%' height={14} borderRadius={4} style={styles.blockGap6} />
          <SkeletonBase width='95%' height={14} borderRadius={4} style={styles.blockGap6} />
          <SkeletonBase width='85%' height={14} borderRadius={4} />
        </View>
      </View>

      {/* Allergens Section Skeleton */}
      <View style={styles.section}>
        <View style={styles.accordionHeader}>
          <SkeletonBase width={180} height={18} borderRadius={4} />
          <SkeletonBase width={20} height={20} borderRadius={4} />
        </View>
      </View>

      {/* Spacer for footer */}
      <View style={styles.footerSpacer} />
    </View>

    {/* Footer Skeleton */}
    <View style={styles.footer}>
      <View style={styles.footerInfo}>
        <SkeletonBase width={70} height={12} borderRadius={4} style={styles.blockGap6} />
        <SkeletonBase width={90} height={18} borderRadius={4} />
      </View>
      <SkeletonBase width={140} height={50} borderRadius={12} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  headerImageContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
    backgroundColor: SURFACE_MUTED,
  },
  merchantLogoPosition: {
    position: 'absolute',
    bottom: 20,
    insetInlineStart: 20,
  },
  headerTextPosition: {
    position: 'absolute',
    bottom: 20,
    left: 90,
    right: 20,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  locationCard: {
    marginTop: 24,
    backgroundColor: SURFACE_SUBTLE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: SURFACE_MUTED,
    marginVertical: 24,
  },
  section: {
    marginVertical: 8,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionContent: {
    marginTop: 12,
  },
  headerTitleSpacing: {
    marginBottom: 8,
  },
  itemTitleSpacing: {
    marginStart: 12,
  },
  priceSpacing: {
    marginEnd: 8,
  },
  inlineGap6: {
    marginStart: 6,
  },
  inlineGap8: {
    marginStart: 8,
  },
  locationDetails: {
    flex: 1,
    marginStart: 16,
  },
  blockGap6: {
    marginBottom: 6,
  },
  footerSpacer: {
    height: 120,
  },
  footerInfo: {
    flex: 1,
    marginEnd: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: SURFACE,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
});
