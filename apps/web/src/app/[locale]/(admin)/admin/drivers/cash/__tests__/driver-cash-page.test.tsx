import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';

import DriverCashPage from '../page';

import type { DriverCashReconciliation } from '@/types/admin';

/**
 * The admin cash page. Asserted on what reaches the API - the signed handover
 * amount, the recovery decision - because those become ledger rows.
 */

const handover = jest.fn();
const moveFloat = jest.fn();
const resolveRecovery = jest.fn();
let report: DriverCashReconciliation;

jest.mock('@/hooks/use-driver-cash', () => ({
  useDriverCashReconciliation: () => ({ data: report, isLoading: false, isError: false }),
  useRecordDriverHandover: () => ({ mutate: handover, isPending: false }),
  useMoveDriverFloat: () => ({ mutate: moveFloat, isPending: false }),
  useResolveDeliveryRecovery: () => ({ mutate: resolveRecovery, isPending: false }),
}));
jest.mock('@/hooks/use-drivers', () => ({
  useDrivers: () => ({ data: [{ _id: 'd1', firstName: 'Sami', lastName: 'Ben Ali' }] }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const c = en.adminDrivers.cash;

const makeReport = (): DriverCashReconciliation => ({
  window: { from: null, to: null },
  totals: {
    expectedCash: 28,
    collectedCash: 26,
    handedOverCash: 0,
    outstandingOwedByDriver: 6.6,
    outstandingOwedToDriver: 13.2,
    driverDeliveryEarnings: 9.6,
    tftwDeliveryRevenue: 2.4,
    tftwCommissionSettlement: 5,
    lossAmount: 0,
  },
  drivers: [
    {
      driverId: 'd1',
      orders: 3,
      expectedCash: 28,
      collectedCash: 26,
      handedOverCash: 0,
      outstandingOwedByDriver: 6.6,
      outstandingOwedToDriver: 13.2,
      paidToMerchant: 25,
      foodMoneyCollected: 20,
      driverDeliveryEarnings: 9.6,
      tftwDeliveryRevenue: 2.4,
      tftwCommissionSettlement: 5,
      lossAmount: 0,
      shortfall: 2,
      float: 50,
      cashDriverShouldHold: 43.4,
      unallocatedHandovers: 0,
      pendingRecoveries: [
        {
          orderId: '66a1b2c3d4e5f6789012abcd',
          paidToMerchant: 10,
          paymentMethod: 'pay_on_delivery',
          since: '2026-09-24T10:00:00.000Z',
        },
      ],
      flags: ['SHORT_COLLECTION'],
    },
  ],
});

const renderPage = () =>
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <DriverCashPage />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  report = makeReport();
  jest.clearAllMocks();
});

describe('DriverCashPage', () => {
  it('shows each driver by name with the flags the backend raised', () => {
    renderPage();

    expect(screen.getByText('Sami Ben Ali')).toBeTruthy();
    expect(screen.getByText(c.flagSHORT_COLLECTION)).toBeTruthy();
  });

  it('records a handover from the driver as a positive amount', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: c.recordHandover }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(c.handoverAmount), {
      target: { value: '6,6' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: c.submit }));

    expect(handover).toHaveBeenCalledWith({ driverId: 'd1', amount: 6.6 }, expect.anything());
  });

  it('records TFTW paying the driver as a negative amount', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: c.recordHandover }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(c.handoverDirectionOut));
    fireEvent.change(within(dialog).getByLabelText(c.handoverAmount), {
      target: { value: '13.2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: c.submit }));

    expect(handover).toHaveBeenCalledWith({ driverId: 'd1', amount: -13.2 }, expect.anything());
  });

  it('refuses an unreadable amount without calling the API', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: c.recordHandover }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(c.handoverAmount), {
      target: { value: '6.6.6' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: c.submit }));

    expect(handover).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert').textContent).toBe(c.invalidAmount);
  });

  it('asks for confirmation before booking food as lost', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: c.pendingLost }));
    expect(resolveRecovery).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: c.pendingLost }));

    expect(resolveRecovery).toHaveBeenCalledWith(
      { orderId: '66a1b2c3d4e5f6789012abcd', recovery: 'UNRECOVERABLE' },
      expect.anything(),
    );
  });

  it('shows nothing waiting when no failure is pending', () => {
    report.drivers[0]!.pendingRecoveries = [];
    renderPage();

    expect(screen.getByText(c.pendingEmpty)).toBeTruthy();
  });
});
