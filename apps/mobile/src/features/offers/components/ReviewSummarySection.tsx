import IoniconsIcon from '@react-native-vector-icons/ionicons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

type IconName = React.ComponentProps<typeof IoniconsIcon>['name'];

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { Freshness } from '@/lib/react-query/freshness';

import { reviewsService } from '../services/reviewsService';
import {
  HIGHLIGHT_LABEL_KEYS,
  isReviewHighlightKey,
  type ReviewHighlightKey,
} from '../utils/reviewComment';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { colorTokens } from '@/design-system/tokens/colors';

const { base: sp } = spacingTokens;

// ─── Highlight config ────────────────────────────────────────────────────────

const HIGHLIGHT_ICONS: Readonly<Record<ReviewHighlightKey, IconName>> = Object.freeze({
  foodQuality: 'restaurant-outline',
  valueForMoney: 'cash-outline',
  serviceQuality: 'happy-outline',
  packaging: 'cube-outline',
  pickupExperience: 'flash-outline',
  sustainability: 'leaf-outline',
});

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  establishmentId: string;
}

export const ReviewSummarySection: React.FC<Props> = ({ establishmentId }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const { data: summary } = useQuery({
    queryKey: ['establishment-review-summary', establishmentId],
    queryFn: () => reviewsService.getEstablishmentSummary(establishmentId),
    enabled: !!establishmentId,
    staleTime: Freshness.STANDARD,
  });

  if (!summary || summary.totalReviews === 0) return null;

  // Top 3 highlights — sorted by average score descending
  // `isReviewHighlightKey` is an own-property check: the old `key in CONFIG`
  // also matched inherited names such as "toString".
  const topHighlights = Object.entries(summary.averageDetailedRatings ?? {})
    .filter((entry): entry is [ReviewHighlightKey, number] => isReviewHighlightKey(entry[0]))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => key);

  const iconCircleStyle = {
    backgroundColor: theme.colors.primary + '18',
  };

  const starColor = theme.colors.primary;

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text weight='semibold' size='md' style={styles.title}>
        {t('reviews.summaryTitle')}
      </Text>

      {/* Average rating */}
      <View style={styles.ratingRow}>
        <IoniconsIcon name='star' size={28} color={starColor} />
        <Text weight='bold' style={[styles.ratingText, { color: starColor }]}>
          {summary.averageRating.toFixed(1)}
        </Text>
        <Text size='md' color='secondary' style={styles.ratingMax}>
          / 5.0
        </Text>
      </View>

      {/* Top highlights */}
      {topHighlights.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text size='sm' weight='semibold' color='secondary' style={styles.highlightsTitle}>
            {t('reviews.topHighlights', { count: topHighlights.length })}
          </Text>
          {topHighlights.map(key => (
            <View key={key} style={styles.highlightRow}>
              <View style={[styles.iconCircle, iconCircleStyle]}>
                <IoniconsIcon name={HIGHLIGHT_ICONS[key]} size={20} color={theme.colors.primary} />
              </View>
              <Text size='md' style={styles.highlightLabel}>
                {t(HIGHLIGHT_LABEL_KEYS[key])}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Footer */}
      <View style={styles.divider} />
      <Text size='sm' color='secondary' style={styles.footer}>
        {t('reviews.basedOnRatings', { count: summary.totalReviews })}
      </Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: sp[3],
  },
  title: {
    marginBottom: sp[3],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 28,
    lineHeight: 34,
  },
  ratingMax: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colorTokens.base.neutral[200],
    marginVertical: sp[3],
  },
  highlightsTitle: {
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightLabel: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
  },
});
