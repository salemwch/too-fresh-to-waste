/**
 * PickupDetailsCard — when and where to collect the order.
 */

import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';

import { cardStyles } from './cardStyles';

import type { Order } from '../../types/order.types';

const ICON_COLOR = '#888';
const ICON_SIZE = 18;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  text: {
    marginStart: 10,
  },
});

/**
 * Long-form date in the device locale. Falls back to the raw value if the date
 * cannot be parsed — showing what the backend sent beats showing
 * "Invalid Date", and this is display-only.
 */
const useFormattedDate = (scheduledDate: string): string =>
  useMemo(() => {
    const parsed = new Date(scheduledDate);
    if (!Number.isFinite(parsed.getTime())) return scheduledDate;

    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [scheduledDate]);

export interface PickupDetailsCardProps {
  order: Order;
}

const PickupDetailsCardComponent: React.FC<PickupDetailsCardProps> = ({ order }) => {
  const { t } = useTranslation();
  const { pickupDetails } = order;
  const formattedDate = useFormattedDate(pickupDetails.scheduledDate);

  return (
    <Card style={cardStyles.card}>
      <Text
        variant='body'
        size='sm'
        weight='bold'
        color='secondary'
        style={cardStyles.sectionTitle}
      >
        {t('orders.pickupDetails')}
      </Text>

      <View style={styles.row}>
        <Icon name='calendar' family='Ionicons' size={ICON_SIZE} color={ICON_COLOR} />
        <Text variant='body' size='md' style={styles.text}>
          {formattedDate}
        </Text>
      </View>

      <View style={styles.row}>
        <Icon name='time' family='Ionicons' size={ICON_SIZE} color={ICON_COLOR} />
        <Text variant='body' size='md' style={styles.text}>
          {pickupDetails.timeSlot.startTime} – {pickupDetails.timeSlot.endTime}
        </Text>
      </View>

      {pickupDetails.instructions != null && (
        <View style={styles.row}>
          <Icon
            name='information-circle-outline'
            family='Ionicons'
            size={ICON_SIZE}
            color={ICON_COLOR}
          />
          <Text variant='body' size='sm' color='secondary' style={styles.text}>
            {pickupDetails.instructions}
          </Text>
        </View>
      )}
    </Card>
  );
};

export const PickupDetailsCard = memo(PickupDetailsCardComponent);
PickupDetailsCard.displayName = 'PickupDetailsCard';
