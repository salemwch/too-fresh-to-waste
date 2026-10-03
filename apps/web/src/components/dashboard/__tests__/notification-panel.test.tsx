import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import { NotificationBell } from '../notification-panel';
import { useNotificationStore } from '@/lib/notification-store';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

/**
 * The bell used to render `formatCurrency(n.foodPrice, 'TND')` with no locale
 * (always formatting in the browser's locale, see `.claude/rules/ui-ux.md`
 * on the same class of bug across the admin area) and fell back to `?? 0`
 * upstream in `use-merchant-orders-socket.ts`, which fabricated a "0.000 TND"
 * price whenever the backend omitted `pricing.subtotal`. Both are fixed here:
 * the price is hidden entirely when absent or zero (task-17 B4 #3).
 */
describe('NotificationBell', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  });

  function renderBell(locale: 'en' | 'fr' = 'en') {
    return render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        <NotificationBell />
      </NextIntlClientProvider>,
    );
  }

  it('shows the formatted food price for a real amount', () => {
    useNotificationStore.getState().addNewOrder({
      id: 'o1',
      orderNumber: 'ORD-1',
      customerName: 'Amira',
      foodPrice: 12.5,
      createdAt: new Date().toISOString(),
    });
    renderBell();

    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText(/12[.,]5/)).toBeInTheDocument();
  });

  it('hides the price entirely when foodPrice is null (backend omitted it)', () => {
    useNotificationStore.getState().addNewOrder({
      id: 'o2',
      orderNumber: 'ORD-2',
      customerName: 'Sami',
      foodPrice: null,
      createdAt: new Date().toISOString(),
    });
    renderBell();

    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText('Sami')).toBeInTheDocument();
    expect(screen.queryByText('·', { exact: false })).toBeNull();
    expect(screen.queryByText(/0[.,]000/)).toBeNull();
  });

  it('hides the price entirely when foodPrice is 0, never renders "0.000 TND"', () => {
    useNotificationStore.getState().addNewOrder({
      id: 'o3',
      orderNumber: 'ORD-3',
      customerName: 'Rim',
      foodPrice: 0,
      createdAt: new Date().toISOString(),
    });
    renderBell();

    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText('Rim')).toBeInTheDocument();
    expect(screen.queryByText(/0[.,]000/)).toBeNull();
  });
});
