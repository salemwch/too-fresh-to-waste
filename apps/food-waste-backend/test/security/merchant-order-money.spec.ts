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
 * - `GET /orders/stats` - returns counts and an average; no delivery-money
 *   field exists on the response to leak (Task 16 removed the last one,
 *   `totalEarnings`/`totalRevenue`/`totalOriginalValue`).
 * - `GET /orders/merchant-revenue-chart`, `GET /orders/merchant-today-sales` -
 *   removed by Task 16; the shared `merchant-sales` module replaced both.
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
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
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
  /**
   * `true` only for the two routes with no `@Roles` guard at all
   * (`confirm-pickup`, `cancel`) - a CONSUMER can actually reach these in
   * production, so they get a dedicated CONSUMER row asserting the merchant's
   * commission ledger never reaches them either. Verified below in
   * `describe('route guard reachability - CONSUMER')`.
   */
  consumerReachable: boolean;
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
    consumerReachable: false, // @Get() has no @Roles guard, but ORDER_LIST_FIELDS never includes commission.
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
    consumerReachable: false, // @Roles(MERCHANT, LOCATION_MANAGER) - CONSUMER cannot reach this route.
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
    // No @Roles guard, but findOne's DtoClass branch (ConsumerOrderResponseDto)
    // has no `commission` @Expose, so a CONSUMER never receives it regardless
    // of what OrdersService.findById returns. Covered directly in
    // `describe('GET /orders/:id - commission opt-in wiring')` below.
    consumerReachable: false,
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
    consumerReachable: false, // @Roles(MERCHANT, ADMIN) - CONSUMER cannot reach this route.
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
    // No @Roles guard at all - a CONSUMER confirming their own pickup-code
    // reaches this route in production (task-15-fix1-findings.md CRITICAL 1).
    consumerReachable: true,
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
    // No @Roles guard at all - a CONSUMER cancelling their own order reaches
    // this route in production (task-15-fix1-findings.md CRITICAL 1).
    consumerReachable: true,
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
    consumerReachable: false, // @Roles(MERCHANT, ADMIN, LOCATION_MANAGER) - CONSUMER cannot reach this route.
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
    // No @Roles guard, but the hand-built receipt object never sets a
    // `commission` key regardless of role - nothing to leak.
    consumerReachable: false,
  },
];

describe.each(rows)('$id', ({ buildController, run, hasPrivilegedBranch, consumerReachable }) => {
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

  // CRITICAL 1 (task-15-fix1-findings.md): confirm-pickup and cancel have no
  // @Roles guard, so a CONSUMER reaches them in production. The merchant's
  // private commission ledger must not reach a CONSUMER even though
  // OrdersService is mocked here to hand back a full order carrying one -
  // this is `OrdersController.forRole`'s defence-in-depth branch, independent
  // of whether OrdersService.findById's own projection is correct.
  (consumerReachable ? it : it.skip)(
    "never sends the merchant's commission ledger to a CONSUMER",
    async () => {
      const controller = buildController(buildOrder());
      const response = await run(controller, UserRole.CONSUMER);
      const json = JSON.stringify(response);

      expect(json).not.toContain('"commission"');
      expect(json).not.toContain('"dueAfter"');
      expect(json).not.toContain('"dueBefore"');
      expect(json).not.toContain('"accrued"');
    },
  );
});

describe('route guard reachability - CONSUMER', () => {
  // Backs the `consumerReachable` flag on each row above: verifies which
  // routes actually have no @Roles guard (so the CONSUMER row above means
  // something), and which are already blocked at the guard layer.
  it.each(['confirmPickup', 'cancel'] as const)(
    '%s has no @Roles guard - a CONSUMER reaches it in production',
    method => {
      const roles = Reflect.getMetadata(ROLES_KEY, OrdersController.prototype[method]) as
        | UserRole[]
        | undefined;
      expect(roles).toBeUndefined();
    },
  );

  it.each(['updateStatus', 'unlockPickup'] as const)(
    '%s is guarded away from CONSUMER',
    method => {
      const roles = Reflect.getMetadata(ROLES_KEY, OrdersController.prototype[method]) as UserRole[];
      expect(roles).not.toContain(UserRole.CONSUMER);
    },
  );
});

describe('GET /orders/:id - commission opt-in wiring', () => {
  // Proves the CRITICAL 1 fix's opt-in actually connects role -> projection:
  // `OrdersController.findOne` must ask `OrdersService.findById` for
  // `commission` only when the requester is MERCHANT, LOCATION_MANAGER or
  // ADMIN - never by default, and never for CONSUMER.
  it.each([
    [UserRole.MERCHANT, true],
    [UserRole.LOCATION_MANAGER, true],
    [UserRole.ADMIN, true],
    [UserRole.CONSUMER, false],
  ] as const)('passes includeCommission=%s for role %s', async (role, expected) => {
    const findById = jest.fn().mockResolvedValue(buildOrder());
    const controller = new OrdersController(
      { findById } as never,
      noop as never,
      {} as never,
      {} as never,
    );

    await controller.findOne('order-1', reqAs(role));

    expect(findById).toHaveBeenCalledWith('order-1', MERCHANT_ID, role, {
      includeCommission: expected,
    });
  });

  it('still sends commission to MERCHANT and ADMIN, and never to CONSUMER, end to end', async () => {
    for (const [role, shouldContain] of [
      [UserRole.MERCHANT, true],
      [UserRole.ADMIN, true],
      [UserRole.CONSUMER, false],
    ] as const) {
      const controller = new OrdersController(
        { findById: jest.fn().mockResolvedValue(buildOrder()) } as never,
        noop as never,
        {} as never,
        {} as never,
      );
      const response = await controller.findOne('order-1', reqAs(role));
      const json = JSON.stringify(response);
      if (shouldContain) {
        expect(json).toContain('"commission"');
      } else {
        expect(json).not.toContain('"commission"');
      }
    }
  });
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
