/**
 * ImpactStatsRow
 * Three white mini-cards: Bags Saved, kg CO₂ Saved, Liters Water.
 * Design: bold teal number + label + sublabel on white rounded cards.
 *
 * Calculations (1 bag ≈ 1 kg of food by default):
 *   CO₂  = totalKg × 2.5 kg CO₂e   (WRAP / FAO average for mixed food waste)
 *   Water = totalKg × 810 L          (Water Footprint Network global average)
 *
 * Uses `totalBagsSaved` (actual bag count across all orders).
 * Falls back to `totalOrdersCount` for accounts created before the migration.
 */

import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { Text } from '@/design-system/components/atoms';

interface ImpactStatsRowProps {
  totalBagsSaved: number;
}

/** Default weight per surprise bag (kg) — used when offer has no estimatedWeight */
const DEFAULT_WEIGHT_PER_BAG_KG = 1;

/** 1 kg of food waste avoided = 2.7 kg CO₂e (WRAP UK / FAO) */
const CO2_PER_KG = 2.5;

/** 1 kg of food waste avoided = 810 L virtual water (Water Footprint Network) */
const WATER_PER_KG = 810;

/** Format large numbers (e.g. 34000 → "34.0K") */
function formatCompact(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return String(n);
}

interface StatCard {
  value: string;
  label: string;
  sublabel: string;
}

const TEAL = '#005250';
const SURFACE = '#FFFFFF';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#64748B';
const SHADOW = '#000';

const ImpactStatsRowComponent: React.FC<ImpactStatsRowProps> = ({ totalBagsSaved }) => {
  const totalWeightKg = totalBagsSaved * DEFAULT_WEIGHT_PER_BAG_KG;
  const co2Saved = Math.round(totalWeightKg * CO2_PER_KG);
  const waterSaved = Math.round(totalWeightKg * WATER_PER_KG);

  const cards: StatCard[] = [
    {
      value: String(totalBagsSaved),
      label: 'Bags',
      sublabel: 'Saved',
    },
    {
      value: `${co2Saved}`,
      label: 'kg CO\u2082',
      sublabel: 'Saved',
    },
    {
      value: formatCompact(waterSaved),
      label: 'Liters',
      sublabel: 'Water',
    },
  ];

  return (
    <View style={styles.container}>
      <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
        IMPACT
      </Text>
      <View style={styles.row}>
        {cards.map(card => (
          <View key={card.label} style={styles.card}>
            <Text variant='headline' size='lg' weight='bold' style={styles.value}>
              {card.value}
            </Text>
            <Text variant='body' size='sm' weight='medium' style={styles.label}>
              {card.label}
            </Text>
            <Text variant='body' size='xs' color='secondary'>
              {card.sublabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ImpactStatsRow = memo(ImpactStatsRowComponent);
ImpactStatsRowComponent.displayName = 'ImpactStatsRow';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: SURFACE,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  value: {
    color: TEAL,
    marginBottom: 2,
  },
  label: {
    color: TEXT_PRIMARY,
  },
});
