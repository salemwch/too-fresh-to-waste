/**
 * OrderPricingCard.
 *
 * This card shows the user what they paid, so the arithmetic matters. The trap
 * is that `subtotal` is already net of the discount: the "price" line adds the
 * discount back to reconstruct the pre-discount figure. Getting that wrong
 * presents the discounted price as the original and makes the saving look like
 * it applied twice.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Card: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.View, null, children as React.ReactNode),
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
  };
});

import { OrderPricingCard } from '../OrderPricingCard';

import type { Order } from '../../../types/order.types';

const order = (pricing: Partial<Order['pricing']>): Order =>
  ({
    pricing: {
      subtotal: 8,
      discountAmount: 12,
      serviceFee: 0,
      total: 8,
      currency: 'TND',
      ...pricing,
    },
  }) as Order;

/** All rendered text, flattened — rows are label/value pairs. */
const textsOf = (json: unknown): string[] => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node != null && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(json);
  return out;
};

// Joined without a separator: the sign and the amount are adjacent JSX
// children, so any separator here would fabricate a gap the user never sees.
const render$ = (o: Order) => textsOf(render(<OrderPricingCard order={o} />).toJSON()).join('');

describe('OrderPricingCard', () => {
  describe('the pre-discount price', () => {
    // subtotal 8 + discount 12 = the 20 the bag was originally worth.
    it('adds the discount back to show what the items cost before it', () => {
      expect(render$(order({ subtotal: 8, discountAmount: 12 }))).toContain('20.00');
    });

    it('equals the subtotal when nothing was discounted', () => {
      const output = render$(order({ subtotal: 15, discountAmount: 0, total: 15 }));

      expect(output).toContain('15.00');
    });
  });

  describe('the discount line', () => {
    it('is signed negative so it reads as money off', () => {
      expect(render$(order({ discountAmount: 12 }))).toContain('-12.00');
    });

    // A "-0.00 TND" row is noise; the row is omitted entirely instead.
    it('is omitted when there is no discount', () => {
      expect(render$(order({ discountAmount: 0 }))).not.toContain('-0.00');
    });
  });

  describe('the service fee', () => {
    it('is shown when charged', () => {
      expect(render$(order({ serviceFee: 2.5, total: 10.5 }))).toContain('2.50');
    });

    it('is omitted when zero', () => {
      const output = render$(order({ serviceFee: 0, subtotal: 8, discountAmount: 0, total: 8 }));

      expect(output).not.toContain('0.00');
    });
  });

  describe('formatting', () => {
    it('always shows two decimal places', () => {
      expect(render$(order({ subtotal: 8, discountAmount: 0, total: 8 }))).toContain('8.00');
    });

    it('rounds to two decimals rather than printing full precision', () => {
      const output = render$(order({ subtotal: 8.005, discountAmount: 0, total: 8.005 }));

      expect(output).not.toContain('8.005');
    });

    it('renders the order currency, not a hardcoded one', () => {
      expect(render$(order({ currency: 'EUR' }))).toContain('EUR');
    });
  });

  describe('edge values', () => {
    // A fully-discounted (free) bag is a real case for expiring stock.
    it('handles a total of zero', () => {
      const output = render$(order({ subtotal: 0, discountAmount: 20, total: 0 }));

      expect(output).toContain('0.00');
      expect(output).toContain('20.00');
    });

    it('handles a large total without scientific notation', () => {
      const output = render$(order({ subtotal: 1_000_000, discountAmount: 0, total: 1_000_000 }));

      expect(output).toContain('1000000.00');
    });

    // Defensive: a negative discount would otherwise render "--5.00".
    it('never renders a double minus sign', () => {
      expect(render$(order({ discountAmount: 5 }))).not.toContain('--');
    });
  });

  it('is memoised so the screen re-rendering does not rebuild it', () => {
    expect(OrderPricingCard.displayName).toBe('OrderPricingCard');
  });
});
