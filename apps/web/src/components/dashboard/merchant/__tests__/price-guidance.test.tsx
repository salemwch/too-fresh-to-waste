/**
 * The guidance shown next to the price field is the only part of the pricing
 * work that reaches the merchant while the price can still change. Its whole
 * job is the three-way verdict — below / inside / above the suggested range —
 * so the boundaries are what these tests pin, along with the case where there
 * is no honest range to show at all.
 */

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import type { PricingSuggestions } from '@/types/dashboard';
import { PriceGuidance } from '../price-guidance';

const mockQuery = jest.fn();

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  usePricingSuggestions: () => mockQuery(),
}));

const withRange = (range: PricingSuggestions['suggestedPriceRange']) =>
  ({ suggestedPriceRange: range }) as PricingSuggestions;

const renderGuidance = (
  discountedPrice: number,
  range: PricingSuggestions['suggestedPriceRange'] = {
    min: 4,
    max: 6,
    currency: 'TND',
    basis: 'own_history',
  },
) => {
  mockQuery.mockReturnValue({ data: range ? withRange(range) : undefined });
  return render(
    <NextIntlClientProvider locale='en' messages={en}>
      <PriceGuidance discountedPrice={discountedPrice} />
    </NextIntlClientProvider>,
  );
};

const hint = en.dashboard.merchantPricing.hint;

afterEach(() => mockQuery.mockReset());

describe('PriceGuidance', () => {
  it('renders nothing when the merchant has no history and no peers', () => {
    const { container } = renderGuidance(5, null);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing while the guide is still loading', () => {
    mockQuery.mockReturnValue({ data: undefined });
    const { container } = render(
      <NextIntlClientProvider locale='en' messages={en}>
        <PriceGuidance discountedPrice={5} />
      </NextIntlClientProvider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('names the range as the merchant own sold-out history when that is the basis', () => {
    const { container } = renderGuidance(5);
    expect(container.textContent).toContain('Your sold-out bags averaged');
    expect(container.textContent).toContain('4–6 TND');
  });

  it('names the peer basis when the merchant has no history yet', () => {
    const { container } = renderGuidance(5, {
      min: 3.5,
      max: 4.6,
      currency: 'TND',
      basis: 'zone',
    });
    expect(container.textContent).toContain('Similar shops near you charge');
  });

  it.each([
    ['below the floor', 3.9, hint.below],
    ['exactly on the floor', 4, hint.inRange],
    ['inside the range', 5, hint.inRange],
    ['exactly on the ceiling', 6, hint.inRange],
    ['above the ceiling', 6.1, hint.above],
  ])('reads %s', (_label, price, expected) => {
    renderGuidance(price);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('shows the range but withholds a verdict before a price is entered', () => {
    const { container } = renderGuidance(0);

    expect(container.textContent).toContain('4–6 TND');
    for (const verdict of [hint.below, hint.inRange, hint.above]) {
      expect(screen.queryByText(verdict)).toBeNull();
    }
  });

  it('withholds the range from an API build that sends no provenance', () => {
    const { container } = renderGuidance(5, {
      min: 1,
      max: 5,
      currency: 'TND',
    } as PricingSuggestions['suggestedPriceRange']);

    expect(container.innerHTML).toBe('');
  });
});
