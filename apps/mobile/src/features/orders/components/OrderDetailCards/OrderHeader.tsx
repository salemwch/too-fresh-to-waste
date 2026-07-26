/**
 * OrderHeader — title, order number and status badge.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge, Text } from '@/design-system/components/atoms';

import { getStatusBadge } from '../../utils/orderStatus';

import type { Order } from '../../types/order.types';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderNumber: {
    marginTop: 2,
  },
});

export interface OrderHeaderProps {
  order: Order;
}

const OrderHeaderComponent: React.FC<OrderHeaderProps> = ({ order }) => {
  const { t } = useTranslation();
  // Always a translation key — never the raw status. See utils/orderStatus.
  const badge = getStatusBadge(order.status);

  return (
    <View style={styles.header}>
      <View>
        <Text variant='headline' size='lg' weight='bold'>
          {t('orders.orderDetails')}
        </Text>
        <Text variant='body' size='sm' color='secondary' style={styles.orderNumber}>
          #{order.orderNumber}
        </Text>
      </View>
      <Badge label={t(badge.labelKey)} variant={badge.variant} size='md' />
    </View>
  );
};

export const OrderHeader = memo(OrderHeaderComponent);
OrderHeader.displayName = 'OrderHeader';
