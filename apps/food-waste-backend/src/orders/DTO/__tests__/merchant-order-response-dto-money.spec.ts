/**
 * A7: `MerchantOrderResponseDto` must not declare a field as present that
 * `toMerchantOrderView`'s `STRIP_PATHS` removes at runtime - `pricing.total`,
 * `pricing.deliveryFee`, `paymentDetails.amount` and `paymentSession` were all
 * typed as always-present `!` fields on the merchant DTO, inherited unchanged
 * from `ConsumerOrderResponseDto`, even though every real call site strips
 * them first. This runs the DTO directly (no `toMerchantOrderView` in the
 * middle) so it is the DTO's own declaration under test, not the upstream
 * strip - a future call site that skips the strip and trusts the type would
 * otherwise still leak.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';

import { STRIP_PATHS } from '../../utils/merchant-order-view';
import { ConsumerOrderResponseDto, MerchantOrderResponseDto } from '../order-response.dto';

const DELIVERY_FEE = 7.777;
const CUSTOMER_TOTAL = 17.777;
const PAYMENT_AMOUNT = 17.777;

function buildFullOrder() {
  return {
    _id: 'order-1',
    orderNumber: 'ORD-1',
    status: 'picked_up',
    paymentStatus: 'paid',
    customerId: { _id: 'c', firstName: 'A', lastName: 'B', email: 'a@b.com' },
    establishmentId: { _id: 'e', name: 'Est', type: 'restaurant' },
    merchantId: { _id: 'm', firstName: 'M', lastName: 'N', email: 'm@n.com' },
    items: [],
    pickupDetails: {
      timeSlot: { startTime: '18:00', endTime: '19:00' },
      scheduledDate: '2026-01-01',
      actualPickupTime: '2026-01-01T18:00:00.000Z',
      qrCode: 'qr-1',
      instructions: 'ring the bell',
      pickupCode: '123456',
    },
    paymentDetails: { method: 'pay_on_delivery', amount: PAYMENT_AMOUNT, currency: 'TND' },
    pricing: {
      subtotal: 10,
      discountAmount: 0,
      taxAmount: 0,
      deliveryFee: DELIVERY_FEE,
      total: CUSTOMER_TOTAL,
      currency: 'TND',
    },
    establishmentAddress: { street: 's', city: 'c', postalCode: '1000', country: 'TN' },
    paymentSession: {
      provider: 'konnect',
      reference: 'ref-1',
      payUrl: 'https://pay.example/session/1',
      expiresAt: '2026-01-01T00:00:00.000Z',
    },
    commission: {
      model: 'V2',
      kind: 'NORMAL',
      accrued: 0,
      settled: 0,
      merchantAmount: 10,
      dueBefore: 0,
      dueAfter: 0,
      appliedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

describe('MerchantOrderResponseDto - never declares a STRIP_PATHS field as present (A7)', () => {
  it('sanity: STRIP_PATHS still classifies these four as stripped', () => {
    expect(STRIP_PATHS.has('pricing.deliveryFee')).toBe(true);
    expect(STRIP_PATHS.has('pricing.total')).toBe(true);
    expect(STRIP_PATHS.has('paymentDetails.amount')).toBe(true);
    expect(STRIP_PATHS.has('paymentSession')).toBe(true);
  });

  it('transforms a full, un-stripped order with none of the stripped fields present', () => {
    const dto = plainToInstance(MerchantOrderResponseDto, buildFullOrder(), {
      excludeExtraneousValues: true,
    });
    const json = JSON.stringify(dto);

    expect(json).not.toContain(String(DELIVERY_FEE));
    expect(json).not.toContain(String(CUSTOMER_TOTAL));
    expect(json).not.toContain('paymentSession');
    expect(dto.pricing).not.toHaveProperty('deliveryFee');
    expect(dto.pricing).not.toHaveProperty('total');
    expect(dto.paymentDetails).not.toHaveProperty('amount');
    expect(dto).not.toHaveProperty('paymentSession');
  });

  it('still keeps every food-only field', () => {
    const dto = plainToInstance(MerchantOrderResponseDto, buildFullOrder(), {
      excludeExtraneousValues: true,
    });
    expect(dto.pricing).toEqual({ subtotal: 10, discountAmount: 0, taxAmount: 0, currency: 'TND' });
    expect(dto.paymentDetails).toEqual({ method: 'pay_on_delivery', currency: 'TND' });
  });

  it('ConsumerOrderResponseDto is untouched - a customer still gets the full pricing/paymentDetails/paymentSession', () => {
    const dto = plainToInstance(ConsumerOrderResponseDto, buildFullOrder(), {
      excludeExtraneousValues: true,
    });
    expect(dto.pricing).toMatchObject({ deliveryFee: DELIVERY_FEE, total: CUSTOMER_TOTAL });
    expect(dto.paymentDetails).toMatchObject({ amount: PAYMENT_AMOUNT });
    expect(dto.paymentSession).toBeDefined();
  });
});
