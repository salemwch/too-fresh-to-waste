/**
 * DeletedOfferCard Component
 * Shows placeholder for favorited offers that were deleted
 */

import Icon from '@react-native-vector-icons/ionicons';
import React from 'react';
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/design-system/components/atoms';

interface DeletedOfferCardProps {
  onRemove: () => void;
  style?: StyleProp<ViewStyle>;
}

const COLORS = {
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  dangerSurface: '#FEE2E2',
  danger: '#EF4444',
} as const;

export const DeletedOfferCard: React.FC<DeletedOfferCardProps> = ({ onRemove, style }) => (
  <View style={[styles.container, style]}>
    <View style={styles.iconContainer}>
      <Icon name='alert-circle-outline' size={48} color={COLORS.textMuted} />
    </View>

    <Text style={styles.title}>Offer No Longer Available</Text>
    <Text style={styles.description}>This offer has been removed by the merchant</Text>

    <Pressable accessibilityRole='button' style={styles.removeButton} onPress={onRemove}>
      <Icon name='trash-outline' size={18} color={COLORS.danger} />
      <Text style={styles.removeButtonText}>Remove from Favorites</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.dangerSurface,
    gap: 6,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
