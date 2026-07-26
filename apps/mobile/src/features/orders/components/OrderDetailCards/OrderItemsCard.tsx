/**
 * OrderItemsCard — what was bought, with per-item pricing.
 *
 * The struck-through original price only appears when the item was actually
 * discounted; showing it at parity would imply a saving that was not made.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design-system/components/atoms';

import { cardStyles } from './cardStyles';

import type { Order } from '../../types/order.types';

type OrderItem = Order['items'][0];

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  left: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
});

/** `offerId` arrives raw or populated depending on the endpoint. */
const itemKey = (item: OrderItem): string =>
  typeof item.offerId === 'string' ? item.offerId : item.offerId._id;

interface ItemRowProps {
  item: OrderItem;
  currency: string;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, currency }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text variant='body' size='md' weight='semibold'>
          {item.offerTitle}
        </Text>
        <Text variant='body' size='sm' color='secondary'>
          {t('common.quantity')}: {item.quantity}
        </Text>
      </View>
      <View style={styles.right}>
        {item.discountAmount > 0 && (
          <Text variant='body' size='xs' color='secondary' style={styles.originalPrice}>
            {item.originalPrice.toFixed(2)} {currency}
          </Text>
        )}
        <Text variant='body' size='md' weight='semibold'>
          {item.totalPrice.toFixed(2)} {currency}
        </Text>
      </View>
    </View>
  );
};

export interface OrderItemsCardProps {
  order: Order;
}

const OrderItemsCardComponent: React.FC<OrderItemsCardProps> = ({ order }) => {
  const { t } = useTranslation();

  return (
    <Card style={cardStyles.card}>
      <Text
        variant='body'
        size='sm'
        weight='bold'
        color='secondary'
        style={cardStyles.sectionTitle}
      >
        {t('orders.items')}
      </Text>
      {order.items.map((item, index) => (
        <React.Fragment key={itemKey(item)}>
          <ItemRow item={item} currency={order.pricing.currency} />
          {/* Dividers between rows only — never a trailing one. */}
          {index < order.items.length - 1 && <View style={cardStyles.divider} />}
        </React.Fragment>
      ))}
    </Card>
  );
};

export const OrderItemsCard = memo(OrderItemsCardComponent);
OrderItemsCard.displayName = 'OrderItemsCard';
