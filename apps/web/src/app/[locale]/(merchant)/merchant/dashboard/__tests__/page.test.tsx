import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import MerchantDashboardPage from '../page';

/**
 * The Dashboard reads `period` from the URL (`useSalesPeriod`, real - not
 * mocked here, see use-sales-period.test.tsx for that hook's own coverage)
 * and must thread it into every period-based query: the earnings summary and
 * chart, and the three impact-card queries (order stats, carbon, social).
 * `CampaignSidePanel`'s own `useOrderStats()` call is a deliberate exception -
 * its bag milestone is a lifetime figure, not a period one, so it must be
 * called with no arguments even while `ImpactCards`' call to the very same
 * hook carries the period (fix-round item A: this used to leak the period
 * into the panel too).
 *
 * task-15b moved "Money TFTW currently holds" off the Dashboard entirely (to
 * the top of the Payments page) - `useMyWallet` is mocked here only because
 * it is still one of the module's exports; the Dashboard must never call it.
 *
 * Every other dashboard component is mocked to a no-op: this suite tests
 * period wiring, not each card's own rendering (each has its own test file).
 * `EarningsCard`, `ImpactCards`, `CampaignSidePanel` and `TrendChartError`
 * are left real, because they are what actually call the hooks under test
 * (or, for `TrendChartError`, what the chart's `isError` branch must render).
 */

const mockUseOrderStats = jest.fn();
const mockUseCarbonMetrics = jest.fn();
const mockUseSocialImpact = jest.fn();
const mockUseMyWallet = jest.fn();
const mockUseMyEstablishment = jest.fn();
const mockUseMerchantOffersFiltered = jest.fn();

jest.mock('@/hooks/use-merchant-dashboard', () => ({
  useOrderStats: (...args: unknown[]) => mockUseOrderStats(...args),
  useCarbonMetrics: (...args: unknown[]) => mockUseCarbonMetrics(...args),
  useSocialImpact: (...args: unknown[]) => mockUseSocialImpact(...args),
  useMyWallet: (...args: unknown[]) => mockUseMyWallet(...args),
  useMyEstablishment: (...args: unknown[]) => mockUseMyEstablishment(...args),
  useMerchantOffersFiltered: (...args: unknown[]) => mockUseMerchantOffersFiltered(...args),
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
    FundLedgerCard: () => null,
    SmartPricingPanel: () => null,
    ReportingBar: () => null,
    TrendChart: () => null,
    TrendChartSkeleton: () => null,
    PeriodBar: () => null,
    // EarningsCard, ImpactCards, CampaignSidePanel and TrendChartError are
    // left as `actual` - see the file-level comment for why.
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
    mockUseMerchantOffersFiltered.mockReset().mockReturnValue(settled(undefined));
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
    expect(mockUseCarbonMetrics).toHaveBeenCalledWith('7d');
    expect(mockUseSocialImpact).toHaveBeenCalledWith('7d');
  });

  it('never renders the held balance on the Dashboard at all', () => {
    renderPage();

    expect(mockUseMyWallet).not.toHaveBeenCalled();
    expect(screen.queryByText('Money TFTW currently holds')).toBeNull();
    expect(screen.queryByText('Available for payout')).toBeNull();
    expect(screen.queryByText('Awaiting pickup')).toBeNull();
  });

  it("calls useOrderStats twice - once with the period (ImpactCards), once with none (CampaignSidePanel's lifetime milestone)", () => {
    renderPage();

    expect(mockUseOrderStats).toHaveBeenCalledTimes(2);
    expect(mockUseOrderStats).toHaveBeenCalledWith('7d');
    expect(mockUseOrderStats).toHaveBeenCalledWith();
    const calledWithNoArgs = mockUseOrderStats.mock.calls.some(call => call.length === 0);
    expect(calledWithNoArgs).toBe(true);
  });

  it("renders TrendChartError, not a 'no data' message, when the chart query fails", () => {
    mockUseSalesChart.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();

    expect(screen.getByTestId('trend-chart-error')).toBeInTheDocument();
    expect(screen.queryByText('No data available')).toBeNull();
  });
});
