/**
 * DeliveryMoneyCard - the frozen money instruction for this delivery.
 *
 * Every figure comes from `order.driverInstruction`, decided by the backend
 * when the driver collected the order. The app displays; it never computes.
 * The row the driver needs next is the emphasised one: the merchant payment
 * was due at the counter, so on the way to the customer it is the collection.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { typographyTokens } from '@/design-system/tokens/typography';
import { textAlignEnd } from '@/utils/rtl';

import type { DriverInstruction } from '../services/driver.service';

const { base: sp, radius } = spacingTokens;
const { fontSize } = typographyTokens;

export interface DeliveryMoneyCardProps {
  instruction: DriverInstruction;
  paidOnline: boolean;
}

const DeliveryMoneyCardComponent: React.FC<DeliveryMoneyCardProps> = ({
  instruction,
  paidOnline,
}) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const money = (amount: number) => `${amount.toFixed(3)} ${t('common.currency')}`;

  return (
    <View style={styles.card} accessibilityRole='summary'>
      <Text style={styles.title}>{t('driver.moneyTitle')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('driver.payMerchant')}</Text>
        <Text style={styles.value}>{money(instruction.payMerchant)}</Text>
      </View>

      <View style={[styles.row, styles.rowEmphasis]}>
        <Text style={styles.labelEmphasis}>{t('driver.collectFromCustomer')}</Text>
        <Text style={[styles.valueEmphasis, paidOnline && styles.valueOnline]}>
          {paidOnline ? t('driver.paidOnline') : money(instruction.collectFromCustomer)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('driver.youKeep')}</Text>
        <Text style={styles.value}>{money(instruction.driverKeeps)}</Text>
      </View>
    </View>
  );
};

export const DeliveryMoneyCard = memo(DeliveryMoneyCardComponent);
DeliveryMoneyCard.displayName = 'DeliveryMoneyCard';

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: sp.md,
      marginBottom: sp.xs,
      borderWidth: 1,
      borderColor: c.outlineVariant,
      gap: sp.xs,
    },
    title: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: sp.xxs,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: sp.sm,
      paddingVertical: sp.xxs,
    },
    rowEmphasis: {
      backgroundColor: c.primaryContainer,
      borderRadius: radius.md,
      paddingHorizontal: sp.sm,
      paddingVertical: sp.xs,
    },
    label: {
      fontSize: fontSize.base,
      color: c.onSurfaceVariant,
      flexShrink: 1,
    },
    value: {
      fontSize: fontSize.base,
      fontWeight: '600',
      color: c.onSurface,
      fontVariant: ['tabular-nums'],
      textAlign: textAlignEnd(),
    },
    labelEmphasis: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: c.onPrimaryContainer,
      flexShrink: 1,
    },
    valueEmphasis: {
      fontSize: fontSize.lg,
      fontWeight: '800',
      color: c.onPrimaryContainer,
      fontVariant: ['tabular-nums'],
      textAlign: textAlignEnd(),
    },
    valueOnline: {
      fontSize: fontSize.base,
      fontWeight: '700',
    },
  }),
);
