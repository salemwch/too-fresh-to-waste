/**
 * `GET /orders/stats` gained an optional `period`, resolved server-side in
 * Africa/Tunis exactly like the merchant-sales summary/chart
 * (`resolveSalesPeriod`), so the dashboard's KPI cards can follow the same
 * period bar as the earnings card. `startDate` is the older param, still used
 * when `period` is absent (back-compat + admin).
 *
 * This is a controller unit test (mocked `OrdersService`) because the
 * resolution + "period wins" branching lives entirely in the controller -
 * `OrdersService.getOrderStats` only ever sees a plain `Date | undefined`, and
 * that half (a `startDate` narrows the aggregation) is proven against a real
 * MongoDB in `order-stats-earnings.integration.spec.ts` and
 * `order-stats-period.integration.spec.ts` (this directory).
 */
import { Types } from 'mongoose';

import { UserRole } from '@foodwaste/shared';

import { OrdersController } from '../order.controller';
import { resolveSalesPeriod } from '../../merchant-sales/merchant-sales.period';

import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';

const USER_ID = new Types.ObjectId().toString();

const makeReq = (role: UserRole = UserRole.MERCHANT): AuthenticatedRequest =>
  ({ user: { userId: USER_ID, email: 'merchant@test.com', role } }) as any;

describe('OrdersController.getOrderStats — period resolution', () => {
  let controller: OrdersController;
  let ordersService: { getOrderStats: jest.Mock };

  beforeEach(() => {
    ordersService = { getOrderStats: jest.fn().mockResolvedValue({ totalOrders: 0 }) };
    controller = new OrdersController(
      ordersService as any,
      { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any,
      {} as any,
      {} as any,
    );
  });

  it('resolves `period` into the same `from` boundary the earnings summary/chart use', async () => {
    const before = Date.now();
    await controller.getOrderStats(makeReq(), { period: '7d' } as any);
    const after = Date.now();

    const [, , startDate] = ordersService.getOrderStats.mock.calls[0];
    // `resolveSalesPeriod` is a pure function of `now`; bracket the call
    // instant rather than freezing the clock, since the controller calls
    // `new Date()` itself.
    const expectedEarliest = resolveSalesPeriod('7d', new Date(before)).from;
    const expectedLatest = resolveSalesPeriod('7d', new Date(after)).from;
    expect(startDate).toEqual(expectedEarliest);
    expect(startDate).toEqual(expectedLatest); // both resolve to the same start-of-day boundary
  });

  it('`period` wins when both `period` and `startDate` are sent', async () => {
    await controller.getOrderStats(makeReq(), {
      period: 'today',
      startDate: '2020-01-01T00:00:00.000Z',
    } as any);

    const [, , startDate] = ordersService.getOrderStats.mock.calls[0];
    expect(startDate?.toISOString().startsWith('2020-01-01')).toBe(false);
  });

  it('falls back to `startDate` when `period` is absent (old callers, admin)', async () => {
    await controller.getOrderStats(makeReq(UserRole.ADMIN), {
      startDate: '2020-01-01T00:00:00.000Z',
    } as any);

    const [, , startDate] = ordersService.getOrderStats.mock.calls[0];
    expect(startDate).toEqual(new Date('2020-01-01T00:00:00.000Z'));
  });

  it('passes no lower bound when neither `period` nor `startDate` is sent (all-time, unchanged)', async () => {
    await controller.getOrderStats(makeReq(), {} as any);

    const [, , startDate] = ordersService.getOrderStats.mock.calls[0];
    expect(startDate).toBeUndefined();
  });

  it("resolves `period: 'all'` to no lower bound too", async () => {
    await controller.getOrderStats(makeReq(), { period: 'all' } as any);

    const [, , startDate] = ordersService.getOrderStats.mock.calls[0];
    expect(startDate).toBeUndefined();
  });
});
