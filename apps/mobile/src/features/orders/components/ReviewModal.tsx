import IoniconsIcon from '@react-native-vector-icons/ionicons';

type IconName = React.ComponentProps<typeof IoniconsIcon>['name'];
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';

import { Text, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { reviewsService } from '@/features/offers/services/reviewsService';
import { showErrorToast, showSuccessToast } from '@/utils/toast';

import { ReviewType } from '@foodwaste/shared';

// ─── Highlight options ────────────────────────────────────────────────────────

interface HighlightOption {
  key: string;
  label: string;
  icon: IconName;
  detailedKey: string;
}

const HIGHLIGHT_OPTIONS: HighlightOption[] = [
  { key: 'food', label: 'Delicious food', icon: 'restaurant-outline', detailedKey: 'foodQuality' },
  { key: 'value', label: 'Great value', icon: 'cash-outline', detailedKey: 'valueForMoney' },
  { key: 'staff', label: 'Friendly staff', icon: 'happy-outline', detailedKey: 'serviceQuality' },
  { key: 'packaged', label: 'Well packaged', icon: 'cube-outline', detailedKey: 'packaging' },
  { key: 'pickup', label: 'Quick pickup', icon: 'flash-outline', detailedKey: 'pickupExperience' },
  { key: 'eco', label: 'Eco-friendly', icon: 'leaf-outline', detailedKey: 'sustainability' },
];

// ─── Comment generation ───────────────────────────────────────────────────────

function buildComment(rating: number, selected: HighlightOption[]): string {
  if (selected.length === 0) {
    if (rating >= 4) return 'Great experience! Really enjoyed this surprise bag.';
    if (rating === 3) return 'Decent experience. The bag was okay overall.';
    return 'Disappointing experience. The bag did not meet my expectations.';
  }
  const labels = selected.map(h => h.label);
  const joined =
    labels.length === 1
      ? labels[0]
      : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
  return `${joined}! Really enjoyed this surprise bag.`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  orderId: string;
  establishmentId: string;
  offerId?: string;
  storeName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReviewModal: React.FC<Props> = ({
  visible,
  orderId,
  establishmentId,
  offerId,
  storeName,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<HighlightOption[]>([]);

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: () => {
      const detailedRatings = selected.reduce<Record<string, number>>((acc, h) => {
        acc[h.detailedKey] = rating;
        return acc;
      }, {});

      return reviewsService.createReview({
        type: ReviewType.ORDER,
        establishmentId,
        orderId,
        ...(offerId ? { offerId } : {}),
        overallRating: rating,
        ...(selected.length > 0 ? { detailedRatings } : {}),
        comment: buildComment(rating, selected),
        tags: selected.map(h => h.key),
        isRecommended: rating >= 4,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['establishment-review-summary', establishmentId],
      });
      showSuccessToast('Thank you for your review!');
      onSuccess();
    },
    onError: () => {
      showErrorToast('Could not submit review. Please try again.');
    },
  });

  const toggleHighlight = (option: HighlightOption) => {
    setSelected(prev =>
      prev.some(h => h.key === option.key)
        ? prev.filter(h => h.key !== option.key)
        : [...prev, option],
    );
  };

  const primaryColor = theme.colors.primary;
  const canSubmit = rating > 0 && !isPending;

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text weight='bold' size='lg'>
              Rate your bag
            </Text>
            {storeName ? (
              <Text size='sm' color='secondary'>
                {storeName}
              </Text>
            ) : null}
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel='Close'>
              <IoniconsIcon name='close' size={22} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Star rating */}
            <Text size='sm' color='secondary' style={styles.sectionLabel}>
              How was your experience?
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  accessibilityRole='button'
                  accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <IoniconsIcon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? primaryColor : '#d1d5db'}
                  />
                </Pressable>
              ))}
            </View>

            {/* Highlight chips — only appear after star selection */}
            {rating > 0 && (
              <>
                <Text size='sm' color='secondary' style={styles.sectionLabel}>
                  What did you like? (optional)
                </Text>
                <View style={styles.chipsGrid}>
                  {HIGHLIGHT_OPTIONS.map(option => {
                    const isActive = selected.some(h => h.key === option.key);
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => toggleHighlight(option)}
                        accessibilityRole='button'
                        accessibilityState={{ selected: isActive }}
                        style={[
                          styles.chip,
                          {
                            borderColor: isActive ? primaryColor : '#e5e7eb',
                            backgroundColor: isActive ? primaryColor + '12' : 'transparent',
                          },
                        ]}
                      >
                        <IoniconsIcon
                          name={option.icon}
                          size={18}
                          color={isActive ? primaryColor : theme.colors.onSurfaceVariant}
                        />
                        <Text
                          size='sm'
                          weight={isActive ? 'semibold' : 'regular'}
                          style={{ color: isActive ? primaryColor : theme.colors.onSurface }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Submit */}
          <Button
            variant='primary'
            size='lg'
            disabled={!canSubmit}
            onPress={() => submitReview()}
            style={styles.submitBtn}
          >
            {isPending ? <ActivityIndicator size='small' color='#fff' /> : 'Submit Review'}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  header: {
    marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  sectionLabel: {
    marginBottom: 12,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  submitBtn: {
    marginTop: 8,
  },
});
