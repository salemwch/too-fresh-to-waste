/**
 * OrderCard baselines - captured **before** the MD2 palette migration.
 *
 * This card carries 15 of the 172 foreign grey literals, more than any other
 * file in the app, and none of the 78 baselines committed in phase 1 contained
 * a single one of them. Phase 4 could therefore have rewritten every colour on
 * the most-seen card in the product with the whole suite staying green.
 *
 * These are what make that migration reviewable: the diff on this file's
 * snapshot *is* the visual change, expressed as resolved values.
 *
 * Not a screenshot - see src/test-utils/visualMatrix.tsx for the boundary.
 */

import React from 'react';

import { matrixSnapshot, FULL_CASES } from '@/test-utils/visualMatrix';
import { makeOrder } from '@/test-utils/fixtures/order';
import { OrderStatus } from '@foodwaste/shared';

import { OrderCard } from '../OrderCard';

jest.mock('@/hooks/usePressGuard', () => ({
  usePressGuard: (fn: () => void) => ({ guardedPress: fn, isGuarded: false }),
}));

const noop = () => undefined;

/* Uses the eight-cell FULL_CASES grid: MD2 changes colour and MD3 changes
 * theme, so light/dark has to cross with locale here rather than being sampled
 * on separate axes. */
const CASES = FULL_CASES;

describe('OrderCard', () => {
  /* The status badge is the card's main colour surface, and each status uses a
   * different foreign grey or tint - so statuses are separate baselines rather
   * than one representative case. */
  describe('confirmed, pickup window open', () => {
    matrixSnapshot('confirmed', <OrderCard order={makeOrder()} onPress={noop} />, CASES);
  });

  describe('ready for pickup', () => {
    matrixSnapshot(
      'ready',
      <OrderCard order={makeOrder({ status: OrderStatus.READY_FOR_PICKUP })} onPress={noop} />,
      CASES,
    );
  });

  describe('completed', () => {
    matrixSnapshot(
      'picked-up',
      <OrderCard order={makeOrder({ status: OrderStatus.PICKED_UP })} onPress={noop} />,
      CASES,
    );
  });

  describe('cancelled', () => {
    // A terminal state with its own tint. Included because the audit's rule is
    // that every terminal state must be handled, not just the happy chain.
    matrixSnapshot(
      'cancelled',
      <OrderCard order={makeOrder({ status: OrderStatus.CANCELLED })} onPress={noop} />,
      CASES,
    );
  });

  describe('pickup window closed', () => {
    // Drives the other side of the in-window branch, which is the only part of
    // this card that reads the clock.
    matrixSnapshot(
      'window-closed',
      <OrderCard
        order={makeOrder({
          pickupDetails: {
            ...makeOrder().pickupDetails,
            timeSlot: { startTime: '19:00', endTime: '21:00' },
          },
        })}
        onPress={noop}
      />,
      CASES,
    );
  });
});
