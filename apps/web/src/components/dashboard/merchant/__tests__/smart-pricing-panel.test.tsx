/**
 * The i18n suite proves the messages format. It cannot prove the panel asks for
 * the right key, picks the right variant, or hides a number it has no basis for
 * — those are the failures the merchant actually sees.
 *
 * These tests render the real component against the real `en.json`, so a key
 * renamed on one side and not the other fails here rather than shipping as a
 * raw `dashboard.merchantPricing.tiles.peers` string on the dashboard.
 */

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../messages/en.json';
import type { PricingSuggestions } from '@/types/dashboard';
import { SmartPricingPanel } from '../smart-pricing-panel';

const mockQuery = jest.fn();

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  usePricingSuggestions: () => mockQuery(),
}));

const baseData: PricingSuggestions = {
  merchantStats: {
    avgDiscountedPrice: 6.5,
    avgOriginalPrice: 15,
    avgDiscountPercent: 57,
    fillRate: 72,
    totalOffers: 12,
    totalSold: 40,
    bestDayOfWeek: 2,
    bestHour: 17,
  },
  zoneStats: {
    avgDiscountedPrice: 4.2,
    avgFillRate: 65,
    totalMerchants: 6,
    scope: 'category_city',
  },
  insights: [],
  suggestedPriceRange: { min: 5.9, max: 7.2, currency: 'TND', basis: 'own_history' },
  sample: { windowDays: 60, merchantOffers: 12, merchantSoldOutOffers: 5, peerMerchants: 6 },
};

const renderPanel = (data: PricingSuggestions | undefined, isLoading = false) => {
  mockQuery.mockReturnValue({ data, isLoading });
  return render(
    <NextIntlClientProvider locale='en' messages={en}>
      <SmartPricingPanel />
    </NextIntlClientProvider>,
  );
};

/** Any untranslated key leaks as its own dotted path into the DOM. */
const expectNoRawKeys = (container: HTMLElement) => {
  expect(container.textContent).not.toMatch(/dashboard\.merchantPricing/);
};

afterEach(() => mockQuery.mockReset());

describe('SmartPricingPanel', () => {
  it('renders nothing at all when the query has no data', () => {
    const { container } = renderPanel(undefined);
    expect(container.innerHTML).toBe('');
  });

  it('explains what the card will show instead of vanishing for a new merchant', () => {
    const { container } = renderPanel({
      ...baseData,
      merchantStats: { ...baseData.merchantStats, totalOffers: 0 },
      zoneStats: { avgDiscountedPrice: 0, avgFillRate: 0, totalMerchants: 0, scope: 'none' },
      suggestedPriceRange: null,
      sample: { windowDays: 60, merchantOffers: 0, merchantSoldOutOffers: 0, peerMerchants: 0 },
    });

    expect(screen.getByText(en.dashboard.merchantPricing.empty.title)).toBeTruthy();
    expectNoRawKeys(container);
  });

  it('labels every tile in words, not jargon', () => {
    const { container } = renderPanel(baseData);

    expect(screen.getByText('6.5 TND')).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('4.2 TND')).toBeTruthy();
    expect(screen.getByText('5.9–7.2 TND')).toBeTruthy();
    // The explanation under each number is the point of the redesign.
    expect(screen.getByText(en.dashboard.merchantPricing.tiles.avgPriceHelp)).toBeTruthy();
    expect(screen.getByText(en.dashboard.merchantPricing.tiles.fillRateHelp)).toBeTruthy();
    expectNoRawKeys(container);
  });

  it('hides the peer tile rather than showing a comparison against nobody', () => {
    renderPanel({
      ...baseData,
      zoneStats: { avgDiscountedPrice: 0, avgFillRate: 0, totalMerchants: 0, scope: 'none' },
    });

    expect(screen.queryByText(en.dashboard.merchantPricing.tiles.peers)).toBeNull();
  });

  it('says so when the peer set had to widen past the merchant own business type', () => {
    const { container } = renderPanel({
      ...baseData,
      zoneStats: { ...baseData.zoneStats, scope: 'city', totalMerchants: 11 },
    });

    expect(container.textContent).toContain('not enough shops of your type');
  });

  it('hides the suggested price when there is no basis for one', () => {
    renderPanel({ ...baseData, suggestedPriceRange: null });

    expect(screen.queryByText(en.dashboard.merchantPricing.tiles.suggested)).toBeNull();
  });

  it('states which evidence the suggested range rests on', () => {
    const { container: own } = renderPanel(baseData);
    expect(own.textContent).toContain('your own bags that sold out');

    mockQuery.mockReset();
    const { container: zone } = renderPanel({
      ...baseData,
      suggestedPriceRange: { min: 3.5, max: 4.6, currency: 'TND', basis: 'zone' },
    });
    expect(zone.textContent).toContain('similar shops near you charge');
  });

  it.each([
    ['price_above_zone', { yourPrice: 6.5, zonePrice: 4.2, diffPercent: 55 }, '55%'],
    ['price_below_zone', { yourPrice: 3.1, zonePrice: 4.2, diffPercent: 26 }, '26%'],
    ['low_fill_rate', { fillRate: 38 }, '38%'],
    ['low_discount', { discountPercent: 41 }, '41%'],
    ['best_hour', { hour: 17 }, '17:00'],
  ] as const)('renders the %s advice with its numbers', (type, params, expected) => {
    const { container } = renderPanel({
      ...baseData,
      insights: [{ type, impact: 'high', params: { ...params } }],
    });

    expect(container.textContent).toContain(expected);
    expectNoRawKeys(container);
  });

  it('resolves the best-selling day to a weekday name', () => {
    const { container } = renderPanel({
      ...baseData,
      insights: [{ type: 'best_day', impact: 'medium', params: { day: 2 } }],
    });

    expect(container.textContent).toContain('Tuesday');
  });

  it('renders Sunday rather than falling through on day index 0', () => {
    const { container } = renderPanel({
      ...baseData,
      insights: [{ type: 'best_day', impact: 'medium', params: { day: 0 } }],
    });

    expect(container.textContent).toContain('Sunday');
  });

  it('skips a best-day insight carrying an out-of-range index', () => {
    const { container } = renderPanel({
      ...baseData,
      insights: [{ type: 'best_day', impact: 'medium', params: { day: 9 } }],
    });

    expectNoRawKeys(container);
    expect(container.textContent).not.toContain('undefined');
  });

  it('survives an API build that still sends the old prose payload', () => {
    // Web and backend deploy separately; the old shape has no `sample` and its
    // insights carry `message` instead of `params`.
    const legacy = {
      merchantStats: baseData.merchantStats,
      zoneStats: { avgDiscountedPrice: 4.2, avgFillRate: 65, totalMerchants: 6 },
      insights: [{ type: 'low_fill_rate', impact: 'high', message: 'Your fill rate is 38%.' }],
      suggestedPriceRange: { min: 1, max: 5, currency: 'TND' },
    } as unknown as PricingSuggestions;

    const { container } = renderPanel(legacy);

    expect(container.innerHTML).toBe('');
  });

  it('says how much evidence the numbers rest on', () => {
    const { container } = renderPanel(baseData);
    expect(container.textContent).toContain('12 bag listings');
    expect(container.textContent).toContain('60 days');
  });
});
