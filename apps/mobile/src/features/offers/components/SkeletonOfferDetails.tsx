/**
 * Skeleton Offer Details Component
 *
 * Loading skeleton for OfferDetailsScreen
 * Mimics the layout of the actual offer details for better UX
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { SkeletonBase } from '@/components/Loading/SkeletonBase';

export const SkeletonOfferDetails: React.FC = () => {
  return (
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
          <SkeletonBase width={180} height={20} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonBase width={120} height={14} borderRadius={4} />
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        {/* Offer Type and Price Row */}
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <SkeletonBase width={20} height={20} borderRadius={4} />
            <SkeletonBase width={120} height={18} borderRadius={4} style={{ marginLeft: 12 }} />
          </View>
          <View style={styles.priceRow}>
            <SkeletonBase width={70} height={16} borderRadius={4} style={{ marginRight: 8 }} />
            <SkeletonBase width={80} height={22} borderRadius={4} />
          </View>
        </View>

        {/* Rating Skeleton */}
        <View style={styles.ratingRow}>
          <SkeletonBase width={16} height={16} borderRadius={4} />
          <SkeletonBase width={40} height={16} borderRadius={4} style={{ marginLeft: 6 }} />
          <SkeletonBase width={50} height={16} borderRadius={4} style={{ marginLeft: 6 }} />
        </View>

        {/* Pickup Time Row */}
        <View style={styles.pickupRow}>
          <SkeletonBase width={20} height={20} borderRadius={4} />
          <SkeletonBase width={200} height={16} borderRadius={4} style={{ marginLeft: 8 }} />
          <SkeletonBase width={60} height={20} borderRadius={4} style={{ marginLeft: 8 }} />
        </View>

        {/* Location Card Skeleton */}
        <View style={styles.locationCard}>
          <View style={styles.locationContent}>
            <SkeletonBase width={32} height={32} borderRadius={16} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <SkeletonBase width='80%' height={16} borderRadius={4} style={{ marginBottom: 6 }} />
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
            <SkeletonBase width='100%' height={14} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBase width='95%' height={14} borderRadius={4} style={{ marginBottom: 6 }} />
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
        <View style={{ height: 120 }} />
      </View>

      {/* Footer Skeleton */}
      <View style={styles.footer}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <SkeletonBase width={70} height={12} borderRadius={4} style={{ marginBottom: 6 }} />
          <SkeletonBase width={90} height={18} borderRadius={4} />
        </View>
        <SkeletonBase width={140} height={50} borderRadius={12} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerImageContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  merchantLogoPosition: {
    position: 'absolute',
    bottom: 20,
    left: 20,
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
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#f3f4f6',
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
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
});
