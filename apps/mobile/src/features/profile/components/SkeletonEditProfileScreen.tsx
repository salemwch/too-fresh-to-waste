/**
 * SkeletonEditProfileScreen Component
 * Loading skeleton displayed while profile is saving.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { useTheme } from '@/design-system/providers';

import type { StyleProp, ViewStyle } from 'react-native';

const CARD_SHADOW = '#000';

type SkeletonAnimValue = React.ComponentProps<typeof SkeletonBox>['animValue'];

interface SkeletonInputProps {
  animValue: SkeletonAnimValue;
  color: string;
  style?: StyleProp<ViewStyle>;
}

interface SkeletonSectionHeaderProps {
  animValue: SkeletonAnimValue;
  color: string;
}

const SkeletonInput: React.FC<SkeletonInputProps> = ({ animValue, color, style }) => (
  <View style={[styles.inputWrapper, style]}>
    <SkeletonBox animValue={animValue} width={80} height={14} borderRadius={7} color={color} />
    <SkeletonBox
      animValue={animValue}
      width='100%'
      height={48}
      borderRadius={12}
      color={color}
      style={styles.inputBox}
    />
  </View>
);

const SkeletonSectionHeader: React.FC<SkeletonSectionHeaderProps> = ({ animValue, color }) => (
  <View style={styles.sectionHeader}>
    <SkeletonBox animValue={animValue} width={20} height={20} borderRadius={10} color={color} />
    <SkeletonBox
      animValue={animValue}
      width={160}
      height={18}
      borderRadius={9}
      color={color}
      style={styles.sectionTitleBox}
    />
  </View>
);

export const SkeletonEditProfileScreen: React.FC = () => {
  const theme = useTheme();
  const anim = useShimmerAnimation('pulse');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.avatarSection}>
            <SkeletonBox
              animValue={anim}
              width={96}
              height={96}
              borderRadius={48}
              color={theme.colors.outline}
            />
            <SkeletonBox
              animValue={anim}
              width={140}
              height={36}
              borderRadius={18}
              color={theme.colors.outline}
              style={styles.changePhotoBtn}
            />
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SkeletonSectionHeader animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
        </View>

        {/* Address Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SkeletonSectionHeader animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
          <SkeletonInput animValue={anim} color={theme.colors.outline} />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <SkeletonInput animValue={anim} color={theme.colors.outline} />
            </View>
            <View style={styles.halfWidth}>
              <SkeletonInput animValue={anim} color={theme.colors.outline} />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <SkeletonBox
            animValue={anim}
            width='100%'
            height={52}
            borderRadius={12}
            color={theme.colors.outline}
          />
          <SkeletonBox
            animValue={anim}
            width='100%'
            height={44}
            borderRadius={12}
            color={theme.colors.outline}
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
    shadowColor: CARD_SHADOW,
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
