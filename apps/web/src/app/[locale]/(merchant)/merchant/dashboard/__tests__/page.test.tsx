import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import MerchantDashboardPage from '../page';

/**
 * The Dashboard reads `period` from the URL (`useSalesPeriod`, real - not
 * mocked here, see use-sales-period.test.tsx for that hook's own coverage)
 * and must thread it into every period-based query: the earnings summary and
 * chart, and the three impact-card queries (order stats, carbon, social). The
 * held-money balance is the one deliberate exception - `useMyWallet`'s query
 * key carries no period (CLAUDE.md: never put the viewer's id in a cache
 * key; the same applies to the period here), so it must be called with no
 * arguments regardless of what the URL says.
 *
 * Every other dashboard component is mocked to a no-op: this suite tests
 * period wiring, not each card's own rendering (each has its own test file).
 * `EarningsCard` and `ImpactCards` are the two real, unmocked components,
 * because they are the ones that actually call the hooks under test.
 */

const mockUseOrderStats = jest.fn();
const mockUseCarbonMetrics = jest.fn();
const mockUseSocialImpact = jest.fn();
const mockUseMyWallet = jest.fn();
const mockUseMyEstablishment = jest.fn();

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useOrderStats: (...args: unknown[]) => mockUseOrderStats(...args),
  useCarbonMetrics: (...args: unknown[]) => mockUseCarbonMetrics(...args),
  useSocialImpact: (...args: unknown[]) => mockUseSocialImpact(...args),
  useMyWallet: (...args: unknown[]) => mockUseMyWallet(...args),
  useMyEstablishment: (...args: unknown[]) => mockUseMyEstablishment(...args),
}));

const mockUseSalesSummary = jest.fn();
const mockUseSalesChart = jest.fn();
jest.mock('@/hooks/use-merchant-sales', () => ({
  useSalesSummary: (...args: unknown[]) => mockUseSalesSummary(...args),
  useSalesChart: (...args: unknown[]) => mockUseSalesChart(...args),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('period=7d'),
}));

jest.mock('@/i18n/routing', () => ({
  usePathname: () => '/en/merchant/dashboard',
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('@/components/dashboard/merchant', () => {
  const actual = jest.requireActual('@/components/dashboard/merchant');
  return {
    ...actual,
    SurpriseBagPanel: () => null,
    DashboardWelcomeHeader: () => null,
    StreakWidget: () => null,
    CampaignSidePanel: () => null,
    FundLedgerCard: () => null,
    SmartPricingPanel: () => null,
    ReportingBar: () => null,
    CommissionCard: () => null,
    TrendChart: () => null,
    TrendChartSkeleton: () => null,
    TrendChartError: () => null,
    PeriodBar: () => null,
    // EarningsCard and ImpactCards are left as `actual` - they are the real
    // components whose hook calls this suite inspects.
  };
});

const settled = (data: unknown) => ({ data, isLoading: false, isError: false });

function renderPage() {
  return render(
    <NextIntlClientProvider locale='en' messages={en}>
      <MerchantDashboardPage />
    </NextIntlClientProvider>,
  );
}

describe('MerchantDashboardPage - period wiring', () => {
  beforeEach(() => {
    mockUseOrderStats.mockReset().mockReturnValue(settled(undefined));
    mockUseCarbonMetrics.mockReset().mockReturnValue(settled(undefined));
    mockUseSocialImpact.mockReset().mockReturnValue(settled(undefined));
    mockUseMyWallet.mockReset().mockReturnValue(settled(undefined));
    mockUseMyEstablishment.mockReset().mockReturnValue(settled(undefined));
    mockUseSalesSummary.mockReset().mockReturnValue(settled(undefined));
    mockUseSalesChart.mockReset().mockReturnValue(settled(undefined));
  });

  it('passes the URL period (?period=7d) to useSalesSummary, useSalesChart and the three impact hooks', () => {
    renderPage();

    // useSalesSummary is called twice - once by EarningsCard, once by
    // ImpactCards - both must carry the period.
    expect(mockUseSalesSummary).toHaveBeenCalledWith('7d');
    mockUseSalesSummary.mock.calls.forEach(call => expect(call).toEqual(['7d']));

    expect(mockUseSalesChart).toHaveBeenCalledWith('7d');
    expect(mockUseOrderStats).toHaveBeenCalledWith('7d');
    expect(mockUseCarbonMetrics).toHaveBeenCalledWith('7d');
    expect(mockUseSocialImpact).toHaveBeenCalledWith('7d');
  });

  it('never passes the period to useMyWallet', () => {
    renderPage();

    expect(mockUseMyWallet).toHaveBeenCalled();
    mockUseMyWallet.mock.calls.forEach(call => expect(call).toEqual([]));
  });
});
