/**
 * SkeletonEditProfileScreen Component
 * Loading skeleton displayed while profile is saving.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { useTheme } from '@/design-system/providers';
import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

export const SkeletonEditProfileScreen: React.FC = () => {
  const theme = useTheme();
  const anim = useShimmerAnimation('pulse');

  const SkeletonInput = ({ style }: { style?: object }) => (
    <View style={[styles.inputWrapper, style]}>
      <SkeletonBox animValue={anim} width={80} height={14} borderRadius={7} color={theme.colors.outline} />
      <SkeletonBox
        animValue={anim}
        width='100%'
        height={48}
        borderRadius={12}
        color={theme.colors.outline}
        style={styles.inputBox}
      />
    </View>
  );

  const SkeletonSectionHeader = () => (
    <View style={styles.sectionHeader}>
      <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} color={theme.colors.outline} />
      <SkeletonBox animValue={anim} width={160} height={18} borderRadius={9} color={theme.colors.outline} style={styles.sectionTitleBox} />
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
            <SkeletonBox animValue={anim} width={96} height={96} borderRadius={48} color={theme.colors.outline} />
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
          <SkeletonBox animValue={anim} width='100%' height={52} borderRadius={12} color={theme.colors.outline} />
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
