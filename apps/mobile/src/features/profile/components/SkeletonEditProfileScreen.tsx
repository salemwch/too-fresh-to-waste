/**
 * SkeletonEditProfileScreen Component
 * Loading skeleton displayed while profile is saving
 *
 * Mirrors the EditProfileScreen layout:
 * - Avatar circle + "Change Photo" button
 * - Personal Information section (4 input fields)
 * - Address section (4 input fields, last 2 side-by-side)
 * - Action buttons (Save + Cancel)
 *
 * Pattern: Opacity shimmer (0.3→0.7) — same as SkeletonCheckoutScreen
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

import { useTheme } from '@/design-system/providers';

export const SkeletonEditProfileScreen: React.FC = () => {
  const theme = useTheme();
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
    style?: object;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.outline,
          borderRadius,
          opacity: shimmerOpacity,
        },
        style,
      ]}
    />
  );

  /** Skeleton for a single input field (label + input box) */
  const SkeletonInput = ({ style }: { style?: object }) => (
    <View style={[styles.inputWrapper, style]}>
      <SkeletonBox width={80} height={14} borderRadius={7} />
      <SkeletonBox
        width='100%'
        height={48}
        borderRadius={12}
        style={styles.inputBox}
      />
    </View>
  );

  /** Section header skeleton (icon + title) */
  const SkeletonSectionHeader = () => (
    <View style={styles.sectionHeader}>
      <SkeletonBox width={20} height={20} borderRadius={10} />
      <SkeletonBox width={160} height={18} borderRadius={9} style={styles.sectionTitleBox} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.avatarSection}>
            <SkeletonBox width={96} height={96} borderRadius={48} />
            <SkeletonBox
              width={140}
              height={36}
              borderRadius={18}
              style={styles.changePhotoBtn}
            />
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SkeletonSectionHeader />
          <SkeletonInput />
          <SkeletonInput />
          <SkeletonInput />
          <SkeletonInput />
        </View>

        {/* Address Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SkeletonSectionHeader />
          <SkeletonInput />
          <SkeletonInput />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <SkeletonInput />
            </View>
            <View style={styles.halfWidth}>
              <SkeletonInput />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <SkeletonBox width='100%' height={52} borderRadius={12} />
          <SkeletonBox
            width='100%'
            height={44}
            borderRadius={12}
            style={styles.cancelBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  changePhotoBtn: {
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleBox: {
    marginLeft: 8,
  },
  inputWrapper: {
    marginBottom: 12,
  },
  inputBox: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: 8,
  },
  cancelBtn: {
    marginTop: 12,
  },
});
