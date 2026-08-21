/**
 * The rollout map is the only section on the site whose order is not authored
 * by us — the API ranks queued cities by demand, and the client must render
 * that order rather than impose one. These tests pin that, plus the states
 * where the honest answer is to show nothing.
 */

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';
import type { PublicImpact, PublicZone } from '@/types/public';
import RolloutMap from '../RolloutMap';

const zonesQuery = jest.fn();
const impactQuery = jest.fn();

jest.mock('@/hooks/use-public', () => ({
  usePublicZones: () => zonesQuery(),
  usePublicImpact: () => impactQuery(),
  useJoinWaitlist: () => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

const zone = (over: Partial<PublicZone> & Pick<PublicZone, 'name' | 'status'>): PublicZone => ({
  displayName: over.name,
  partners: 0,
  bagsRescued: 0,
  peopleWaiting: 0,
  foundingTarget: 0,
  foundingSigned: 0,
  launchedAt: null,
  ...over,
});

const IMPACT: PublicImpact = {
  bagsRescued: 3120,
  mealsRescued: 7815,
  partners: 41,
  carbonAvoidedKg: 8940,
  people: 4210,
  citiesLive: 1,
  peopleWaiting: 5553,
  generatedAt: '2026-08-21T00:00:00.000Z',
};

const ZONES: PublicZone[] = [
  zone({ name: 'Sousse', status: 'active', partners: 41, bagsRescued: 3120 }),
  zone({
    name: 'Monastir',
    status: 'coming_soon',
    foundingTarget: 50,
    foundingSigned: 34,
    peopleWaiting: 1402,
  }),
  zone({ name: 'Tunis', status: 'inactive', peopleWaiting: 2847 }),
  zone({ name: 'Mahdia', status: 'inactive', peopleWaiting: 612 }),
];

const renderMap = (
  {
    zones = ZONES,
    impact = IMPACT,
    isLoading = false,
    isError = false,
  }: {
    zones?: PublicZone[] | undefined;
    impact?: PublicImpact | undefined;
    isLoading?: boolean;
    isError?: boolean;
  } = {},
  locale: 'en' | 'fr' | 'ar' = 'en',
) => {
  zonesQuery.mockReturnValue({ data: zones, isLoading, isError });
  impactQuery.mockReturnValue({ data: impact });

  const messages = { en, fr, ar }[locale];
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RolloutMap />
    </NextIntlClientProvider>,
  );
};

afterEach(() => {
  zonesQuery.mockReset();
  impactQuery.mockReset();
});

describe('RolloutMap', () => {
  it('renders the cities in the order the API returned them', () => {
    const { container } = renderMap();

    const rendered = [...container.querySelectorAll('h3')].map(h => h.textContent);
    // Sousse, Monastir, then the queued cities by demand — Tunis (2 847) above
    // Mahdia (612). The panel repeats Monastir, which is why it appears twice.
    expect(rendered.slice(0, 4)).toEqual(['Sousse', 'Monastir', 'Tunis', 'Mahdia']);
  });

  it('does not re-sort the queue on the client', () => {
    // Handed a deliberately "wrong" order, the component must still trust the
    // server: the ranking is the product decision, not a presentation detail.
    const { container } = renderMap({
      zones: [
        zone({ name: 'Mahdia', status: 'inactive', peopleWaiting: 1 }),
        zone({ name: 'Tunis', status: 'inactive', peopleWaiting: 9999 }),
      ],
    });

    const rendered = [...container.querySelectorAll('h3')].map(h => h.textContent);
    expect(rendered.slice(0, 2)).toEqual(['Mahdia', 'Tunis']);
  });

  it('shows the unlock counter for the city opening next', () => {
    const { container } = renderMap();

    expect(container.textContent).toContain('34 of 50');
    expect(container.textContent).toContain('16 left to open Monastir');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('34');
  });

  it('draws no meter for a city with no unlock target', () => {
    renderMap({
      zones: [zone({ name: 'Sfax', status: 'coming_soon', peopleWaiting: 10 })],
    });

    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows partner and rescue history only for a city that has opened', () => {
    const { container } = renderMap();

    expect(container.textContent).toContain('41 partners');
    expect(container.textContent).toContain('2,847 people waiting');
  });

  it('renders nothing rather than an invented map when the request fails', () => {
    const { container } = renderMap({ isError: true });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no city has been published yet', () => {
    const { container } = renderMap({ zones: [] });
    expect(container.innerHTML).toBe('');
  });

  it('shows a skeleton rather than an empty rail while loading', () => {
    const { container } = renderMap({ zones: undefined, isLoading: true });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('leaves the stat chips blank until the totals arrive', () => {
    const { container } = renderMap({ impact: undefined as unknown as PublicImpact });
    // A dash, never a zero — "0 bags rescued" is a claim, and a wrong one.
    expect(container.textContent).toContain('—');
  });

  it('keeps the panel to the single city that is unlocking next', () => {
    const { container } = renderMap({
      zones: [
        zone({ name: 'Sousse', status: 'coming_soon', foundingTarget: 20, foundingSigned: 5 }),
        zone({ name: 'Monastir', status: 'coming_soon', foundingTarget: 50, foundingSigned: 34 }),
      ],
    });

    // The status pill repeats per row, so count the panel itself: exactly one
    // call to action on the section, taken from the first such city.
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });

  it.each(['en', 'fr', 'ar'] as const)('resolves every key in %s', locale => {
    const { container } = renderMap({}, locale);
    expect(container.textContent).not.toMatch(/rollout\./);
  });
});

describe('rollout copy', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  it('carries an identical key set in every locale', () => {
    const [enKeys, frKeys, arKeys] = [en, fr, ar].map(m =>
      flatten((m as { rollout: unknown }).rollout).sort(),
    );
    expect(enKeys.length).toBeGreaterThan(0);
    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);
  });
});
