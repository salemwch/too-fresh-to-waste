/**
 * SkeletonCheckoutScreen Component
 * Loading skeleton for CheckoutScreen with premium design.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';

import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

export const SkeletonCheckoutScreen: React.FC = () => {
  const anim = useShimmerAnimation('pulse');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Card Skeleton */}
        <View style={styles.mainCard}>
          {/* Offer Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} />
              <SkeletonBox animValue={anim} width={140} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            <View style={styles.offerDetailsCard}>
              <View style={styles.offerImageRow}>
                <SkeletonBox animValue={anim} width={90} height={90} borderRadius={12} />
                <View style={styles.offerDetails}>
                  <SkeletonBox animValue={anim} width="100%" height={20} borderRadius={10} />
                  <SkeletonBox animValue={anim} width="70%" height={16} style={{ marginTop: 8 }} borderRadius={8} />
                </View>
              </View>

              <View style={styles.quantitySection}>
                <View style={styles.quantityLabelRow}>
                  <SkeletonBox animValue={anim} width={60} height={15} borderRadius={7.5} />
                </View>
                <View style={styles.quantityStepper}>
                  <SkeletonBox animValue={anim} width={40} height={40} borderRadius={20} />
                  <SkeletonBox animValue={anim} width={60} height={28} style={{ marginHorizontal: 24 }} borderRadius={14} />
                  <SkeletonBox animValue={anim} width={40} height={40} borderRadius={20} />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.pickupInfo}>
                <View style={styles.pickupRow}>
                  <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
                  <SkeletonBox animValue={anim} width={120} height={14} style={{ marginLeft: 10 }} borderRadius={7} />
                </View>
                <View style={[styles.pickupRow, { marginTop: 10 }]}>
                  <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
                  <SkeletonBox animValue={anim} width={100} height={14} style={{ marginLeft: 10 }} borderRadius={7} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* Payment Method Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} />
              <SkeletonBox animValue={anim} width={130} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            <View style={styles.paymentMethod}>
              <SkeletonBox animValue={anim} width={48} height={48} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <SkeletonBox animValue={anim} width="60%" height={16} borderRadius={8} />
                <SkeletonBox animValue={anim} width="80%" height={13} style={{ marginTop: 6 }} borderRadius={6.5} />
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* Order Summary Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} />
              <SkeletonBox animValue={anim} width={120} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            <View style={styles.priceBreakdown}>
              <View style={styles.priceRow}>
                <SkeletonBox animValue={anim} width={60} height={15} borderRadius={7.5} />
                <SkeletonBox animValue={anim} width={80} height={15} borderRadius={7.5} />
              </View>
              <View style={styles.priceRow}>
                <SkeletonBox animValue={anim} width={70} height={15} borderRadius={7.5} />
                <SkeletonBox animValue={anim} width={80} height={15} borderRadius={7.5} />
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <SkeletonBox animValue={anim} width={90} height={17} borderRadius={8.5} />
                <SkeletonBox animValue={anim} width={100} height={22} borderRadius={11} />
              </View>
            </View>
          </View>

          <View style={styles.confirmButtonWrapper}>
            <SkeletonBox animValue={anim} width="100%" height={56} borderRadius={16} />
          </View>

          <View style={{ marginTop: 12 }}>
            <SkeletonBox animValue={anim} width="100%" height={48} borderRadius={12} />
          </View>

          <View style={styles.trustBadge}>
            <SkeletonBox animValue={anim} width={160} height={12} borderRadius={6} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 16,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  offerDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offerImageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  offerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  quantitySection: {
    marginTop: 16,
    marginBottom: 16,
  },
  quantityLabelRow: {
    marginBottom: 12,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  pickupInfo: {
    gap: 10,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 24,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceBreakdown: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalRow: {
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  confirmButtonWrapper: {
    marginTop: 8,
    marginBottom: 12,
  },
  trustBadge: {
    alignItems: 'center',
    marginTop: 16,
  },
});
