/**
 * SkeletonCheckoutScreen Component
 * Loading skeleton for CheckoutScreen with premium design
 *
 * 🎨 PREMIUM UI/UX:
 * - Matches actual checkout layout
 * - Smooth shimmer animations
 * - Professional loading experience
 * - No jarring spinner
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export const SkeletonCheckoutScreen: React.FC = () => {
  // Shimmer animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({
    width,
    height,
    borderRadius = 8,
    style,
  }: {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E2E8F0',
          borderRadius,
          opacity: shimmerOpacity,
        },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Skeleton */}
        <LinearGradient
          colors={['#005250', '#007B77', '#005250']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <SkeletonBox width={40} height={40} borderRadius={20} />
            <SkeletonBox width={200} height={28} style={{ marginTop: 12 }} borderRadius={14} />
            <SkeletonBox width={150} height={14} style={{ marginTop: 6 }} borderRadius={7} />
          </View>
        </LinearGradient>

        {/* Main Card Skeleton */}
        <View style={styles.mainCard}>
          {/* Offer Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={140} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            <View style={styles.offerDetailsCard}>
              {/* Image and Details Row */}
              <View style={styles.offerImageRow}>
                <SkeletonBox width={90} height={90} borderRadius={12} />
                <View style={styles.offerDetails}>
                  <SkeletonBox width="100%" height={20} borderRadius={10} />
                  <SkeletonBox width="70%" height={16} style={{ marginTop: 8 }} borderRadius={8} />
                </View>
              </View>

              {/* Quantity Section */}
              <View style={styles.quantitySection}>
                <View style={styles.quantityLabelRow}>
                  <SkeletonBox width={60} height={15} borderRadius={7.5} />
                </View>
                <View style={styles.quantityStepper}>
                  <SkeletonBox width={40} height={40} borderRadius={20} />
                  <SkeletonBox width={60} height={28} style={{ marginHorizontal: 24 }} borderRadius={14} />
                  <SkeletonBox width={40} height={40} borderRadius={20} />
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Pickup Info */}
              <View style={styles.pickupInfo}>
                <View style={styles.pickupRow}>
                  <SkeletonBox width={18} height={18} borderRadius={9} />
                  <SkeletonBox width={120} height={14} style={{ marginLeft: 10 }} borderRadius={7} />
                </View>
                <View style={[styles.pickupRow, { marginTop: 10 }]}>
                  <SkeletonBox width={18} height={18} borderRadius={9} />
                  <SkeletonBox width={100} height={14} style={{ marginLeft: 10 }} borderRadius={7} />
                </View>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Payment Method Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={130} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            {/* Payment Option */}
            <View style={styles.paymentMethod}>
              <SkeletonBox width={48} height={48} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <SkeletonBox width="60%" height={16} borderRadius={8} />
                <SkeletonBox width="80%" height={13} style={{ marginTop: 6 }} borderRadius={6.5} />
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Order Summary Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={120} height={18} style={{ marginLeft: 8 }} borderRadius={9} />
            </View>

            <View style={styles.priceBreakdown}>
              {/* Price rows */}
              <View style={styles.priceRow}>
                <SkeletonBox width={60} height={15} borderRadius={7.5} />
                <SkeletonBox width={80} height={15} borderRadius={7.5} />
              </View>
              <View style={styles.priceRow}>
                <SkeletonBox width={70} height={15} borderRadius={7.5} />
                <SkeletonBox width={80} height={15} borderRadius={7.5} />
              </View>
              {/* Total row */}
              <View style={[styles.priceRow, styles.totalRow]}>
                <SkeletonBox width={90} height={17} borderRadius={8.5} />
                <SkeletonBox width={100} height={22} borderRadius={11} />
              </View>
            </View>
          </View>

          {/* Confirm Button Skeleton */}
          <View style={styles.confirmButtonWrapper}>
            <SkeletonBox width="100%" height={56} borderRadius={16} />
          </View>

          {/* Cancel Button Skeleton */}
          <View style={{ marginTop: 12 }}>
            <SkeletonBox width="100%" height={48} borderRadius={12} />
          </View>

          {/* Trust Badge Skeleton */}
          <View style={styles.trustBadge}>
            <SkeletonBox width={160} height={12} borderRadius={6} />
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
  },

  // Header
  headerGradient: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    alignItems: 'center',
  },

  // Main Card
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

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Offer Details
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

  // Quantity Section
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

  // Pickup Info
  pickupInfo: {
    gap: 10,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Section Divider
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 24,
  },

  // Payment Method
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Price Breakdown
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

  // Buttons
  confirmButtonWrapper: {
    marginTop: 8,
    marginBottom: 12,
  },

  // Trust Badge
  trustBadge: {
    alignItems: 'center',
    marginTop: 16,
  },
});
