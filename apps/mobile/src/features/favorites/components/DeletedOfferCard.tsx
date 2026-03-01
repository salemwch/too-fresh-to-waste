/**
 * DeletedOfferCard Component
 * Shows placeholder for favorited offers that were deleted
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';

import { Text } from '@/design-system/components/atoms';

interface DeletedOfferCardProps {
  onRemove: () => void;
  style?: any;
}

export const DeletedOfferCard: React.FC<DeletedOfferCardProps> = ({ onRemove, style }) => {

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon name="alert-circle-outline" size={48} color="#9CA3AF" />
      </View>

      <Text style={styles.title}>Offer No Longer Available</Text>
      <Text style={styles.description}>
        This offer has been removed by the merchant
      </Text>

      <Pressable style={styles.removeButton} onPress={onRemove}>
        <Icon name="trash-outline" size={18} color="#EF4444" />
        <Text style={styles.removeButtonText}>Remove from Favorites</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
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
    backgroundColor: '#FEE2E2',
    gap: 6,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
