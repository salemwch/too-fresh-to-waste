import IoniconsIcon from '@react-native-vector-icons/ionicons';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, StyleSheet } from 'react-native';

type IconName = React.ComponentProps<typeof IoniconsIcon>['name'];

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { Freshness } from '@/lib/react-query/freshness';

import { reviewsService } from '../services/reviewsService';

// ─── Highlight config ────────────────────────────────────────────────────────

interface HighlightConfig {
  label: string;
  icon: IconName;
}

const HIGHLIGHT_CONFIG: Record<string, HighlightConfig> = {
  foodQuality: { label: 'Delicious food', icon: 'restaurant-outline' },
  valueForMoney: { label: 'Great value', icon: 'cash-outline' },
  serviceQuality: { label: 'Friendly staff', icon: 'happy-outline' },
  packaging: { label: 'Well packaged', icon: 'cube-outline' },
  pickupExperience: { label: 'Quick pickup', icon: 'flash-outline' },
  sustainability: { label: 'Eco-friendly', icon: 'leaf-outline' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  establishmentId: string;
}

export const ReviewSummarySection: React.FC<Props> = ({ establishmentId }) => {
  const theme = useTheme();

  const { data: summary } = useQuery({
    queryKey: ['establishment-review-summary', establishmentId],
    queryFn: () => reviewsService.getEstablishmentSummary(establishmentId),
    enabled: !!establishmentId,
    staleTime: Freshness.STANDARD,
  });

  if (!summary || summary.totalReviews === 0) return null;

  // Top 3 highlights — sorted by average score descending
  const topHighlights = Object.entries(summary.averageDetailedRatings ?? {})
    .filter(([key]) => key in HIGHLIGHT_CONFIG)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => HIGHLIGHT_CONFIG[key])
    .filter((h): h is HighlightConfig => h !== undefined);

  const iconCircleStyle = {
    backgroundColor: theme.colors.primary + '18',
  };

  const starColor = theme.colors.primary;

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text weight='semibold' size='md' style={styles.title}>
        What other people are saying
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
            Top {topHighlights.length} highlights
          </Text>
          {topHighlights.map(({ label, icon }) => (
            <View key={label} style={styles.highlightRow}>
              <View style={[styles.iconCircle, iconCircleStyle]}>
                <IoniconsIcon name={icon} size={20} color={theme.colors.primary} />
              </View>
              <Text size='md' style={styles.highlightLabel}>
                {label}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Footer */}
      <View style={styles.divider} />
      <Text size='sm' color='secondary' style={styles.footer}>
        Based on {summary.totalReviews} rating{summary.totalReviews !== 1 ? 's' : ''}
      </Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    marginBottom: 12,
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
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  highlightsTitle: {
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
