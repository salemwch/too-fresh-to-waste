import { render, screen } from '@testing-library/react';

import { OrderDetailContent, OrderCard } from '@/components/dashboard/merchant/orders/orders-page';
import type { MerchantOrder } from '@/types/dashboard';

/**
 * A merchant never sees or receives delivery money: no delivery fee, no
 * customer total, under any label. See `.claude/work/merchant-earnings.md`
 * (Decisions) and `orders/utils/merchant-order-view.ts` on the backend.
 *
 * `t` is passed to these components directly (not via `useTranslations`), so
 * no next-intl provider/mock is needed - just a lookup table per locale.
 */

const LABELS = {
  en: {
    pricing: 'Pricing',
    originalValue: 'Original value',
    discount: 'Discount',
    foodPrice: 'Food price',
    yourEarnings: 'Your earnings',
    customer: 'Customer',
    items: 'Items',
    paymentStatus: 'Payment',
    cancelOrder: 'Cancel Order',
    paymentMethodCash: 'Cash at pickup',
    paymentMethodOnline: 'Online payment',
    paymentMethodDelivery: 'Pay on delivery',
    confirmedPickup: 'Picked up successfully',
  },
  fr: {
    pricing: 'Tarification',
    originalValue: "Valeur d'origine",
    discount: 'Remise',
    foodPrice: 'Prix de la nourriture',
    yourEarnings: 'Vos gains',
    customer: 'Client',
    items: 'Articles',
    paymentStatus: 'Paiement',
    cancelOrder: 'Annuler la commande',
    paymentMethodCash: 'Especes au retrait',
    paymentMethodOnline: 'Paiement en ligne',
    paymentMethodDelivery: 'Paiement a la livraison',
    confirmedPickup: 'Retrait confirme',
  },
  ar: {
    pricing: 'التسعير',
    originalValue: 'القيمة الأصلية',
    discount: 'الخصم',
    foodPrice: 'سعر الطعام',
    yourEarnings: 'أرباحك',
    customer: 'العميل',
    items: 'العناصر',
    paymentStatus: 'الدفع',
    cancelOrder: 'إلغاء الطلب',
    paymentMethodCash: 'نقداً عند الاستلام',
    paymentMethodOnline: 'دفع إلكتروني',
    paymentMethodDelivery: 'الدفع عند التسليم',
    confirmedPickup: 'تم الاستلام بنجاح',
  },
} as const;

function makeT(locale: keyof typeof LABELS) {
  const table: Record<string, string> = LABELS[locale];
  return (key: string) => table[key] ?? key;
}

function baseOrder(overrides: Partial<MerchantOrder> = {}): MerchantOrder {
  return {
    _id: 'order-1',
    orderNumber: 'ORD-1',
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentDetails: { method: 'pay_on_delivery', currency: 'TND' },
    customerId: {
      _id: 'cust-1',
      firstName: 'Amira',
      lastName: 'Ben Ali',
      email: 'amira@example.com',
    },
    establishmentId: 'est-1',
    // Distinctive, deliberately unrelated to the pricing-block fixtures below
    // so item rows never collide with the money-block assertions.
    items: [
      {
        offerId: 'offer-1',
        offerTitle: 'Panier surprise',
        quantity: 1,
        unitPrice: 99,
        totalPrice: 99,
        originalPrice: 199,
        discountAmount: 100,
      },
    ],
    pricing: { subtotal: 10, discountAmount: 10, taxAmount: 0, currency: 'TND' },
    pickupDetails: { pickupCode: '123456' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OrderDetailContent - a merchant never sees delivery money', () => {
  it('renders Original value, Discount and Food price, and never a fee or a total', () => {
    const order = baseOrder({
      pricing: { subtotal: 10, discountAmount: 10, taxAmount: 0, currency: 'TND' },
    });
    render(<OrderDetailContent order={order} t={makeT('en')} onCancel={jest.fn()} />);

    expect(screen.getByText('Original value')).toBeInTheDocument();
    expect(screen.getByText('TND 20.000')).toBeInTheDocument(); // subtotal + discountAmount
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-TND 10.000')).toBeInTheDocument();
    expect(screen.getByText('Food price')).toBeInTheDocument();
    expect(screen.getByText('TND 10.000')).toBeInTheDocument();

    expect(screen.queryByText(/Tax/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivery Fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Total$/)).not.toBeInTheDocument();
  });

  it('shows no money block and no invented 0.000 when pricing is absent', () => {
    const order = baseOrder({ pricing: undefined as unknown as MerchantOrder['pricing'] });
    render(<OrderDetailContent order={order} t={makeT('en')} onCancel={jest.fn()} />);

    expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.000/)).not.toBeInTheDocument();
  });

  it('hides the Discount row when discountAmount is 0', () => {
    const order = baseOrder({
      pricing: { subtotal: 10, discountAmount: 0, taxAmount: 0, currency: 'TND' },
    });
    render(<OrderDetailContent order={order} t={makeT('en')} onCancel={jest.fn()} />);

    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    // Original value (subtotal + 0) and Food price (subtotal) are both 10 here.
    expect(screen.getAllByText('TND 10.000')).toHaveLength(2);
  });

  it('does not show "Your earnings" when commission is absent', () => {
    const order = baseOrder();
    render(<OrderDetailContent order={order} t={makeT('en')} onCancel={jest.fn()} />);

    expect(screen.queryByText('Your earnings')).not.toBeInTheDocument();
  });

  it('shows "Your earnings" with the settlement merchantAmount, not the food price, when commission is present', () => {
    const order = baseOrder({
      pricing: { subtotal: 10, discountAmount: 5, taxAmount: 0, currency: 'TND' },
      commission: { merchantAmount: 4 },
    });
    render(<OrderDetailContent order={order} t={makeT('en')} onCancel={jest.fn()} />);

    expect(screen.getByText('Your earnings')).toBeInTheDocument();
    expect(screen.getByText('TND 4.000')).toBeInTheDocument();
    // The food price (10) is still shown separately - not conflated with earnings.
    expect(screen.getByText('TND 10.000')).toBeInTheDocument();
  });

  it('renders the French labels', () => {
    const order = baseOrder({ commission: { merchantAmount: 4 } });
    render(<OrderDetailContent order={order} t={makeT('fr')} onCancel={jest.fn()} />);

    expect(screen.getByText("Valeur d'origine")).toBeInTheDocument();
    expect(screen.getByText('Prix de la nourriture')).toBeInTheDocument();
    expect(screen.getByText('Vos gains')).toBeInTheDocument();
  });

  it('renders the Arabic labels', () => {
    const order = baseOrder({ commission: { merchantAmount: 4 } });
    render(<OrderDetailContent order={order} t={makeT('ar')} onCancel={jest.fn()} />);

    expect(screen.getByText('القيمة الأصلية')).toBeInTheDocument();
    expect(screen.getByText('سعر الطعام')).toBeInTheDocument();
    expect(screen.getByText('أرباحك')).toBeInTheDocument();
  });
});

describe('OrderCard (list row) - shows the food price, never the customer total', () => {
  it('shows pricing.subtotal, not pricing.total', () => {
    const order = baseOrder({
      pricing: { subtotal: 10, discountAmount: 0, taxAmount: 0, currency: 'TND' },
    });
    render(<OrderCard order={order} onClick={jest.fn()} t={makeT('en')} />);

    expect(screen.getByText('TND 10.000')).toBeInTheDocument();
  });

  it('shows the food price for a pickup cash order (what the merchant collects in store)', () => {
    const order = baseOrder({
      paymentDetails: { method: 'cash', currency: 'TND' },
      pricing: { subtotal: 15, discountAmount: 0, taxAmount: 0, currency: 'TND' },
    });
    render(<OrderCard order={order} onClick={jest.fn()} t={makeT('en')} />);

    expect(screen.getByText('TND 15.000')).toBeInTheDocument();
  });
});
