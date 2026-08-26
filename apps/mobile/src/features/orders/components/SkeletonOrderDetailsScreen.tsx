/**
 * SkeletonOrderDetailsScreen
 * Shimmer skeleton that mirrors OrderDetailsScreen layout exactly.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';

import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';

const { base: sp } = spacingTokens;

export const SkeletonOrderDetailsScreen: React.FC = () => {
  const styles = useStyles();
  const anim = useShimmerAnimation('pulse');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <SkeletonBox animValue={anim} width={160} height={24} borderRadius={12} />
            <SkeletonBox
              animValue={anim}
              width={100}
              height={14}
              borderRadius={7}
              style={styles.subheader}
            />
          </View>
          <SkeletonBox animValue={anim} width={76} height={28} borderRadius={14} />
        </View>

        {/* Items card */}
        <View style={styles.card}>
          <SkeletonBox
            animValue={anim}
            width={48}
            height={12}
            borderRadius={6}
            style={styles.sectionTitle}
          />
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <SkeletonBox animValue={anim} width={150} height={16} borderRadius={8} />
              <SkeletonBox
                animValue={anim}
                width={60}
                height={13}
                borderRadius={6}
                style={styles.itemMeta}
              />
            </View>
            <SkeletonBox animValue={anim} width={64} height={16} borderRadius={8} />
          </View>
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <SkeletonBox animValue={anim} width={120} height={16} borderRadius={8} />
              <SkeletonBox
                animValue={anim}
                width={50}
                height={13}
                borderRadius={6}
                style={styles.itemMeta}
              />
            </View>
            <SkeletonBox animValue={anim} width={64} height={16} borderRadius={8} />
          </View>
        </View>

        {/* Pricing card */}
        <View style={styles.card}>
          <SkeletonBox
            animValue={anim}
            width={65}
            height={12}
            borderRadius={6}
            style={styles.sectionTitle}
          />
          <View style={styles.pricingRow}>
            <SkeletonBox animValue={anim} width={60} height={16} borderRadius={8} />
            <SkeletonBox animValue={anim} width={68} height={16} borderRadius={8} />
          </View>
          <View style={styles.pricingRow}>
            <SkeletonBox animValue={anim} width={40} height={16} borderRadius={8} />
            <SkeletonBox animValue={anim} width={68} height={16} borderRadius={8} />
          </View>
          <View style={styles.pricingRow}>
            <SkeletonBox animValue={anim} width={75} height={16} borderRadius={8} />
            <SkeletonBox animValue={anim} width={68} height={16} borderRadius={8} />
          </View>
          <View style={styles.divider} />
          <View style={styles.pricingRow}>
            <SkeletonBox animValue={anim} width={42} height={18} borderRadius={9} />
            <SkeletonBox animValue={anim} width={88} height={20} borderRadius={10} />
          </View>
        </View>

        {/* Pickup Details card */}
        <View style={styles.card}>
          <SkeletonBox
            animValue={anim}
            width={115}
            height={12}
            borderRadius={6}
            style={styles.sectionTitle}
          />
          <View style={styles.pickupRow}>
            <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
            <SkeletonBox
              animValue={anim}
              width={170}
              height={16}
              borderRadius={8}
              style={styles.pickupDetail}
            />
          </View>
          <View style={styles.pickupRow}>
            <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
            <SkeletonBox
              animValue={anim}
              width={110}
              height={16}
              borderRadius={8}
              style={styles.pickupDetail}
            />
          </View>
        </View>

        {/* Confirm Pickup card */}
        <View style={styles.card}>
          <SkeletonBox
            animValue={anim}
            width={120}
            height={12}
            borderRadius={6}
            style={styles.sectionTitle}
          />
          <SkeletonBox animValue={anim} width='100%' height={13} borderRadius={6} />
          <SkeletonBox
            animValue={anim}
            width='70%'
            height={13}
            borderRadius={6}
            style={styles.confirmationHint}
          />
          <SkeletonBox animValue={anim} width='100%' height={56} borderRadius={12} />
          <SkeletonBox
            animValue={anim}
            width='100%'
            height={48}
            borderRadius={12}
            style={styles.confirmButton}
          />
        </View>

        <SkeletonBox
          animValue={anim}
          width='100%'
          height={40}
          borderRadius={8}
          style={styles.footerAction}
        />
      </ScrollView>
    </View>
  );
};

const useStyles = createThemedStyles((c: ThemePalette) => {
  const SCREEN_BACKGROUND = c.surfaceVariant;
  const SURFACE = c.surface;
  const DIVIDER = c.outlineVariant;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: SCREEN_BACKGROUND,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    card: {
      backgroundColor: SURFACE,
      borderRadius: 8,
      padding: 16,
      marginBottom: sp[3],
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    sectionTitle: {
      marginBottom: sp[3],
    },
    subheader: {
      marginTop: 4,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    itemLeft: {
      flex: 1,
    },
    itemMeta: {
      marginTop: 4,
    },
    pricingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    pickupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    pickupDetail: {
      marginStart: 10,
    },
    confirmationHint: {
      marginTop: 5,
      marginBottom: sp[3],
    },
    confirmButton: {
      marginTop: 16,
    },
    footerAction: {
      marginTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: DIVIDER,
      marginVertical: 8,
    },
  });
});
