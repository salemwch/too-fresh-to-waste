import IoniconsIcon from '@react-native-vector-icons/ionicons';

type IconName = React.ComponentProps<typeof IoniconsIcon>['name'];
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';

import { Text, Button } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { reviewsService } from '@/features/offers/services/reviewsService';
import {
  HIGHLIGHT_LABEL_KEYS,
  buildReviewComment,
  type ReviewHighlightKey,
} from '@/features/offers/utils/reviewComment';
import { offlineWriteQueue } from '@/services/OfflineWriteQueue';
import { offlineManager } from '@/utils/offlineManager';
import { showSuccessToast } from '@/utils/toast';

import { ReviewType } from '@foodwaste/shared';

import type { CreateReviewRequest } from '@foodwaste/shared';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { colorTokens } from '@/design-system/tokens/colors';

const { base: sp } = spacingTokens;

// ─── Highlight options ────────────────────────────────────────────────────────

interface HighlightOption {
  /** Sent as the review tag. */
  key: string;
  icon: IconName;
  detailedKey: ReviewHighlightKey;
}

const HIGHLIGHT_OPTIONS: HighlightOption[] = [
  { key: 'food', icon: 'restaurant-outline', detailedKey: 'foodQuality' },
  { key: 'value', icon: 'cash-outline', detailedKey: 'valueForMoney' },
  { key: 'staff', icon: 'happy-outline', detailedKey: 'serviceQuality' },
  { key: 'packaged', icon: 'cube-outline', detailedKey: 'packaging' },
  { key: 'pickup', icon: 'flash-outline', detailedKey: 'pickupExperience' },
  { key: 'eco', icon: 'leaf-outline', detailedKey: 'sustainability' },
];

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
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<HighlightOption[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Built once and shared by the online and offline paths, so a queued review
  // is byte-identical to one submitted live.
  const buildRequest = useCallback((): CreateReviewRequest => {
    const detailedRatings = selected.reduce<Record<string, number>>((acc, h) => {
      acc[h.detailedKey] = rating;
      return acc;
    }, {});

    return {
      type: ReviewType.ORDER,
      establishmentId,
      orderId,
      ...(offerId ? { offerId } : {}),
      overallRating: rating,
      ...(selected.length > 0 ? { detailedRatings } : {}),
      comment: buildReviewComment(
        rating,
        selected.map(h => h.detailedKey),
        t,
      ),
      tags: selected.map(h => h.key),
      isRecommended: rating >= 4,
    };
  }, [selected, rating, establishmentId, orderId, offerId, t]);

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: () => reviewsService.createReview(buildRequest()),
    onSuccess: () => {
      setSubmitError(null);
      void queryClient.invalidateQueries({
        queryKey: ['establishment-review-summary', establishmentId],
      });
      showSuccessToast(t('reviews.thankYou'));
      onSuccess();
    },
    onError: () => {
      setSubmitError(t('reviews.submitFailed'));
    },
  });

  const toggleHighlight = (option: HighlightOption) => {
    setSelected(prev =>
      prev.some(h => h.key === option.key)
        ? prev.filter(h => h.key !== option.key)
        : [...prev, option],
    );
  };

  /**
   * Offline reviews are queued rather than lost. A review is still correct when
   * it lands minutes later — nothing else depends on its timing — so unlike
   * checkout it is safe to defer.
   */
  const handleSubmit = useCallback(() => {
    if (offlineManager.isOffline()) {
      offlineWriteQueue.enqueue({
        id: `REVIEW_SUBMIT:${orderId}`,
        type: 'REVIEW_SUBMIT',
        payload: buildRequest(),
      });
      showSuccessToast(t('reviews.savedOffline'));
      onSuccess();
      return;
    }

    submitReview();
  }, [buildRequest, orderId, submitReview, onSuccess, t]);

  const primaryColor = theme.colors.primary;
  const canSubmit = rating > 0 && !isPending;

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text weight='bold' size='lg'>
              {t('orders.rateBag')}
            </Text>
            {storeName ? (
              <Text size='sm' color='secondary'>
                {storeName}
              </Text>
            ) : null}
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole='button'
              accessibilityLabel={t('common.close')}
              accessibilityHint={t('orders.a11yCloseReview')}
            >
              <IoniconsIcon name='close' size={22} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Star rating */}
            <Text size='sm' color='secondary' style={styles.sectionLabel}>
              {t('reviews.rateYourExperience')}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  accessibilityRole='button'
                  accessibilityLabel={t(
                    star > 1 ? 'orders.a11yRateStarPlural' : 'orders.a11yRateStar',
                    { count: star },
                  )}
                  accessibilityHint={t('orders.a11yRateStarHint', { count: star })}
                >
                  <IoniconsIcon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? primaryColor : colorTokens.base.neutral[300]}
                  />
                </Pressable>
              ))}
            </View>

            {/* Highlight chips — only appear after star selection */}
            {rating > 0 && (
              <>
                <Text size='sm' color='secondary' style={styles.sectionLabel}>
                  {t('reviews.whatDidYouLike')}
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
                            borderColor: isActive ? primaryColor : theme.colors.outlineVariant,
                            backgroundColor: isActive
                              ? primaryColor + CHIP_TINT_ALPHA
                              : TRANSPARENT,
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
                          {t(HIGHLIGHT_LABEL_KEYS[option.detailedKey])}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Inline error */}
          {submitError !== null && (
            <View
              style={[
                styles.errorRow,
                { backgroundColor: theme.colors.errorContainer ?? '#FEE2E2' },
              ]}
            >
              <IoniconsIcon
                name='alert-circle-outline'
                size={16}
                color={theme.colors.onErrorContainer}
              />
              <Text
                size='sm'
                style={[styles.inlineErrorText, { color: theme.colors.onErrorContainer }]}
              >
                {submitError}
              </Text>
            </View>
          )}

          {/* Submit */}
          <Button
            variant='primary'
            size='lg'
            disabled={!canSubmit}
            loading={isPending}
            onPress={handleSubmit}
            style={styles.submitBtn}
          >
            {t('reviews.submit')}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

/** 12/255 alpha suffix — a ~7% tint of the primary colour behind an active chip. */
const CHIP_TINT_ALPHA = '12';
const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  // Static half of the error row; the colour stays inline because it is
  // theme-dependent and cannot live in a static StyleSheet.
  inlineErrorText: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: sp[5],
    paddingTop: sp[5],
    paddingBottom: 36,
    maxHeight: '85%',
  },
  header: {
    marginBottom: sp[5],
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    insetInlineEnd: 0,
    padding: 4,
  },
  sectionLabel: {
    marginBottom: sp[3],
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: sp[5],
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: sp[5],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: sp[3],
    paddingVertical: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  submitBtn: {
    marginTop: 8,
  },
});
