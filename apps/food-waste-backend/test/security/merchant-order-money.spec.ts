/**
 * Route-level proof that a MERCHANT or LOCATION_MANAGER response never
 * carries delivery money, and that ADMIN (or the customer, where ADMIN has no
 * access) still gets the full order - so the assertion proves the role
 * branch, not an empty response.
 *
 * Every order-returning route a MERCHANT/LOCATION_MANAGER can reach is driven
 * directly through `OrdersController`, with `OrdersService` mocked to return
 * a fixture order carrying distinctive delivery-money values (`7.777` for the
 * delivery fee, `17.777` for the customer-paid total). Full route enumeration
 * and KEEP/STRIP reasoning: `.claude/work/merchant-earnings.md` (Decisions).
 *
 * Excluded from the table, with why:
 * - `GET /orders/stats`, `GET /orders/merchant-revenue-chart`,
 *   `GET /orders/merchant-today-sales` - Task 16 removes these; out of scope here.
 * - `GET /orders/merchant-sales-summary`, `GET /orders/merchant-sales-chart`,
 *   `GET /payments/my-merchant-payments`, `/my-commission`, `/my-wallet`,
 *   `/stats` - built on the shared `merchant-sales` module, which never reads
 *   `pricing.total`/`pricing.deliveryFee` (grepped: no match).
 * - `GET /orders/merchant-customer-locations` - returns `{ city, count }`, no
 *   money field exists to leak.
 * - `GET /orders/:id/qr-code` - returns the QR image and pickup code only.
 * - `PATCH /orders/approve-expiration` - returns a Mongo `UpdateResult`.
 * - `PATCH /orders/:id/approve-pickup-extension` - returns `{ message }`.
 * - `DELETE /orders/:id`, `POST /orders/update-expired`, `GET /orders/admin/pending`
 *   - ADMIN only; the domain rule only restricts MERCHANT/LOCATION_MANAGER.
 * - Order export (CSV/PDF): no such endpoint exists in this codebase.
 * - Email/push templates: `notification/services/template.service.ts`'s
 *   `order_confirmed` template interpolates no money field (grepped).
 */
import { UserRole } from '@foodwaste/shared';

import { OrdersController } from '../../src/orders/order.controller';
import { OrdersService } from '../../src/orders/order.service';
import type { AuthenticatedRequest } from '../../src/common/decorators/get-user.decorator';
import { UpdateOrderStatusDto, ConfirmPickupDto, CancelOrderDto } from '../../src/orders/DTO/create-order.dto';

const DELIVERY_FEE = 7.777;
const CUSTOMER_TOTAL = 17.777;
const DRIVER_EARNINGS = 6.222;
const PLATFORM_DELIVERY_COMMISSION = 1.555;

const ORDER_ID = '507f191e810c19729de860ea';
const CUSTOMER_ID = '507f191e810c19729de860eb';
const ESTABLISHMENT_ID = '507f191e810c19729de860ec';
const MERCHANT_ID = '507f191e810c19729de860ed';

function buildOrder() {
  return {
    _id: ORDER_ID,
    orderNumber: 'ORD-777',
    status: 'confirmed',
    paymentStatus: 'paid',
    customerId: { _id: CUSTOMER_ID, firstName: 'Cust', lastName: 'Omer', email: 'c@example.com' },
    establishmentId: { _id: ESTABLISHMENT_ID, name: 'Le Panier', type: 'restaurant' },
    merchantId: { _id: MERCHANT_ID, firstName: 'Merch', lastName: 'Ant', email: 'm@example.com' },
    items: [
      {
        offerId: 'offer-1',
        offerTitle: 'Panier surprise',
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
        originalPrice: 20,
        discountAmount: 10,
      },
    ],
    pickupDetails: {
      timeSlot: { startTime: '18:00', endTime: '19:00' },
      scheduledDate: new Date('2026-01-01T18:00:00.000Z'),
      qrCode: 'qr-1',
      pickupCode: '123456',
    },
    paymentDetails: {
      method: 'pay_on_delivery',
      amount: CUSTOMER_TOTAL,
      currency: 'TND',
      processingFee: 0.4,
      stripePaymentIntentId: 'pi_777',
      transactionId: 'txn_777',
    },
    pricing: {
      subtotal: 10,
      discountAmount: 10,
      taxAmount: 0,
      deliveryFee: DELIVERY_FEE,
      total: CUSTOMER_TOTAL,
      currency: 'TND',
      merchantAmount: 10,
      commissionSettled: 0,
    },
    deliveryFee: DELIVERY_FEE,
    driverEarnings: DRIVER_EARNINGS,
    platformDeliveryCommission: PLATFORM_DELIVERY_COMMISSION,
    paymentSession: {
      provider: 'konnect',
      reference: 'ref-777',
      payUrl: 'https://pay.example/session/777',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    commission: {
      model: 'V2',
      kind: 'NORMAL',
      controlledBy: 'TFTW',
      accrued: 1.9,
      settled: 0,
      merchantAmount: 10,
      dueBefore: 0,
      dueAfter: 0,
      appliedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    driverInstruction: {
      payMerchant: 10,
      collectFromCustomer: CUSTOMER_TOTAL,
      driverKeeps: DRIVER_EARNINGS,
      frozenAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deliveryMode: 'delivery',
    donationAmount: 0.05,
  };
}

function reqAs(role: UserRole): AuthenticatedRequest {
  return {
    user: {
      userId: MERCHANT_ID,
      email: 'm@example.com',
      role,
      assignedEstablishmentId: ESTABLISHMENT_ID,
    },
  } as unknown as AuthenticatedRequest;
}

const noop = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

/** One row per Step-1-enumerated route. `run` drives the controller and
 * returns the JSON-serialised response for the given role. */
interface Row {
  id: string;
  buildController: (order: ReturnType<typeof buildOrder>) => OrdersController;
  run: (controller: OrdersController, role: UserRole) => Promise<unknown>;
  /** Some routes have no ADMIN/other-role branch to contrast against. */
  hasPrivilegedBranch: boolean;
}

const rows: Row[] = [
  {
    id: 'GET /orders',
    buildController: order =>
      new OrdersController(
        { findAll: jest.fn().mockResolvedValue({ orders: [order], total: 1 }) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.findAll({} as never, reqAs(role));
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'GET /orders/merchant-orders',
    buildController: order =>
      new OrdersController(
        { findByMerchant: jest.fn().mockResolvedValue({ orders: [order], total: 1 }) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.getMerchantOrders(reqAs(role), 1, 10);
      return response;
    },
    // MERCHANT/LOCATION_MANAGER only - there is no ADMIN branch to prove.
    hasPrivilegedBranch: false,
  },
  {
    id: 'GET /orders/:id',
    buildController: order =>
      new OrdersController(
        { findById: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.findOne('order-1', reqAs(role));
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'PATCH /orders/:id/status',
    buildController: order =>
      new OrdersController(
        { updateStatus: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.updateStatus(
        'order-1',
        { status: 'confirmed' } as UpdateOrderStatusDto,
        reqAs(role),
      );
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'PATCH /orders/:id/confirm-pickup',
    buildController: order =>
      new OrdersController(
        { confirmPickup: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.confirmPickup(
        'order-1',
        { pickupCode: '123456' } as ConfirmPickupDto,
        reqAs(role),
      );
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'PATCH /orders/:id/cancel',
    buildController: order =>
      new OrdersController(
        { cancel: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.cancel(
        'order-1',
        { reason: 'Out of stock today' } as CancelOrderDto,
        reqAs(role),
      );
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'PATCH /orders/:id/unlock-pickup',
    buildController: order =>
      new OrdersController(
        { unlockPickup: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.unlockPickup('order-1', reqAs(role));
      return response;
    },
    hasPrivilegedBranch: true,
  },
  {
    id: 'GET /orders/:id/receipt',
    buildController: order =>
      new OrdersController(
        { findById: jest.fn().mockResolvedValue(order) } as never,
        noop as never,
        {} as never,
        {} as never,
      ),
    run: async (controller, role) => {
      const response = await controller.getOrderReceipt('order-1', reqAs(role));
      return response;
    },
    hasPrivilegedBranch: true,
  },
];

describe.each(rows)('$id', ({ buildController, run, hasPrivilegedBranch }) => {
  it('never sends the delivery fee or the customer total to a MERCHANT', async () => {
    const controller = buildController(buildOrder());
    const response = await run(controller, UserRole.MERCHANT);
    const json = JSON.stringify(response);

    expect(json).not.toContain(String(DELIVERY_FEE));
    expect(json).not.toContain(String(CUSTOMER_TOTAL));
    expect(json).not.toContain(String(DRIVER_EARNINGS));
    expect(json).not.toContain(String(PLATFORM_DELIVERY_COMMISSION));
    expect(json).not.toContain('payUrl');
  });

  it('never sends the delivery fee or the customer total to a LOCATION_MANAGER', async () => {
    const controller = buildController(buildOrder());
    const response = await run(controller, UserRole.LOCATION_MANAGER);
    const json = JSON.stringify(response);

    expect(json).not.toContain(String(DELIVERY_FEE));
    expect(json).not.toContain(String(CUSTOMER_TOTAL));
  });

  (hasPrivilegedBranch ? it : it.skip)(
    'still sends the delivery fee to ADMIN - proving the branch, not an empty response',
    async () => {
      const controller = buildController(buildOrder());
      const response = await run(controller, UserRole.ADMIN);
      const json = JSON.stringify(response);

      expect(json).toContain(String(DELIVERY_FEE));
      expect(json).toContain(String(CUSTOMER_TOTAL));
    },
  );
});

describe('socket: order.service.ts notifyMerchantNewOrder', () => {
  it('sends the food price, never the delivery fee or the customer total', async () => {
    // Constructed directly (bypassing Nest DI) - `notifyMerchantNewOrder` only
    // reads `appLogger`, `userModel`, `establishmentModel` and
    // `webSocketService`/`notificationService` off `this`.
    const service = Object.create(OrdersService.prototype) as Record<string, unknown>;
    const sendToUser = jest.fn();
    service['appLogger'] = noop;
    service['userModel'] = { findOne: () => ({ lean: () => ({ exec: () => null }) }) };
    service['establishmentModel'] = {
      findById: () => ({ lean: () => ({ exec: () => null }) }),
    };
    service['webSocketService'] = { sendToUser };
    service['notificationService'] = { queueNotification: jest.fn().mockResolvedValue(undefined) };

    const order = buildOrder();
    await (service as { notifyMerchantNewOrder: (o: unknown) => Promise<void> }).notifyMerchantNewOrder(
      order,
    );

    expect(sendToUser).toHaveBeenCalledTimes(1);
    const [, event, payload] = sendToUser.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(event).toBe('order:new');
    const json = JSON.stringify(payload);
    expect(json).not.toContain(String(DELIVERY_FEE));
    expect(json).not.toContain(String(CUSTOMER_TOTAL));
    expect(json).toContain('"subtotal":10');
  });
});
