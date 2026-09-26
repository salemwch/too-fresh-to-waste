/**
 * OrderPricingCard — the money breakdown.
 *
 * `subtotal` is already net of the discount, so the "price" line reconstructs
 * the pre-discount figure by adding it back. Showing `subtotal` there instead
 * would present the discounted price as the original and make the saving look
 * like it applied twice.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design-system/components/atoms';

import { cardStyles } from './cardStyles';

import type { Order } from '../../types/order.types';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});

interface PricingRowProps {
  label: string;
  value: number;
  currency: string;
  isBold?: boolean;
  isDiscount?: boolean;
}

const PricingRow: React.FC<PricingRowProps> = ({ label, value, currency, isBold, isDiscount }) => {
  const bold = isBold === true;
  const discount = isDiscount === true;

  return (
    <View style={styles.row}>
      <Text variant='body' size='md' weight={bold ? 'bold' : 'regular'}>
        {label}
      </Text>
      <Text
        variant='body'
        size='md'
        weight={bold ? 'bold' : 'regular'}
        color={discount ? 'success' : ''}
      >
        {discount ? '-' : ''}
        {Math.abs(value).toFixed(2)} {currency}
      </Text>
    </View>
  );
};

export interface OrderPricingCardProps {
  order: Order;
}

const OrderPricingCardComponent: React.FC<OrderPricingCardProps> = ({ order }) => {
  const { t } = useTranslation();
  const { pricing } = order;

  const originalPrice = pricing.subtotal + pricing.discountAmount;

  return (
    <Card style={cardStyles.card}>
      <Text
        variant='body'
        size='sm'
        weight='bold'
        color='secondary'
        style={cardStyles.sectionTitle}
      >
        {t('orders.pricing')}
      </Text>

      {/* Omitted rather than shown as zero when nothing was discounted - the
          original price would then just repeat the subtotal. Same lines and
          labels as the checkout receipt (`checkoutPricing.ts`), so what the
          customer agreed to reads the same after purchase. */}
      {pricing.discountAmount > 0 && (
        <>
          <PricingRow
            label={t('checkout.originalPrice')}
            value={originalPrice}
            currency={pricing.currency}
          />
          <PricingRow
            label={t('orders.discount')}
            value={-pricing.discountAmount}
            currency={pricing.currency}
            isDiscount
          />
        </>
      )}

      <PricingRow
        label={t('common.subtotal')}
        value={pricing.subtotal}
        currency={pricing.currency}
      />

      {/*
        Was `pricing.serviceFee`, already displayed under the "delivery fee"
        label — the value simply did not match the label. It was charged on any
        cash order including pickup, and never on an online-paid delivery. The
        field now matches what it is called.
      */}
      {pricing.deliveryFee > 0 && (
        <>
          <View style={cardStyles.divider} />
          <PricingRow
            label={t('orders.deliveryFee')}
            value={pricing.deliveryFee}
            currency={pricing.currency}
          />
        </>
      )}

      <View style={cardStyles.divider} />
      <PricingRow
        label={t('common.total')}
        value={pricing.total}
        currency={pricing.currency}
        isBold
      />
    </Card>
  );
};

export const OrderPricingCard = memo(OrderPricingCardComponent);
OrderPricingCard.displayName = 'OrderPricingCard';
