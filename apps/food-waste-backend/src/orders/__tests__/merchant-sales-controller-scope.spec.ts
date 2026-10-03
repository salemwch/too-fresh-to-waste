/**
 * Task 17 (A12, Lens 4 #3) - security-relevant controller seam.
 *
 * `OrdersController.salesScope` is a private method that pins a
 * LOCATION_MANAGER to `assignedEstablishmentId`, whatever `establishmentId`
 * the query carries - but nothing executed it before this file. Only
 * `salesScopeFor`/`salesScopeForRequest` (the pure function underneath) had
 * unit tests; the controller methods that actually choose which id to pass it
 * were untested, so a regression there (using `query.establishmentId` for
 * every role) would have let a location manager read any establishment's
 * earnings by passing its id - and nothing would have failed.
 */
import { UserRole } from '@foodwaste/shared';
import { Types } from 'mongoose';

import { OrdersController } from '../order.controller';

import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import type { MerchantSalesQueryDto } from '../../merchant-sales/dto/merchant-sales-query.dto';

// `salesScopeFor` validates `establishmentId` as a real Mongo ObjectId, so
// these must be real hex ids, not arbitrary strings.
const MERCHANT_ID = new Types.ObjectId().toString();
const ASSIGNED_ESTABLISHMENT_ID = new Types.ObjectId().toString();
const OTHER_ESTABLISHMENT_ID = new Types.ObjectId().toString();

const noop = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

function buildController() {
  const merchantSalesService = {
    summary: jest.fn().mockResolvedValue({}),
    chart: jest.fn().mockResolvedValue({}),
  };
  const controller = new OrdersController(
    {} as never,
    noop as never,
    {} as never,
    merchantSalesService as never,
  );
  return { controller, merchantSalesService };
}

const merchantReq = (): AuthenticatedRequest =>
  ({ user: { userId: MERCHANT_ID, role: UserRole.MERCHANT } }) as unknown as AuthenticatedRequest;

const lmReq = (): AuthenticatedRequest =>
  ({
    user: {
      userId: 'lm-1',
      role: UserRole.LOCATION_MANAGER,
      assignedEstablishmentId: ASSIGNED_ESTABLISHMENT_ID,
    },
  }) as unknown as AuthenticatedRequest;

const lmReqNoAssignment = (): AuthenticatedRequest =>
  ({
    user: { userId: 'lm-2', role: UserRole.LOCATION_MANAGER },
  }) as unknown as AuthenticatedRequest;

describe('OrdersController.getMerchantSalesSummary - scope resolution (A12)', () => {
  it('a merchant is scoped to the establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesSummary(merchantReq(), {
      period: 'month',
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantSalesQueryDto);

    expect(merchantSalesService.summary).toHaveBeenCalledWith(
      { kind: 'merchant', merchantId: MERCHANT_ID, establishmentId: OTHER_ESTABLISHMENT_ID },
      'month',
    );
  });

  it('a location manager is pinned to their own assignment, ignoring a different establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesSummary(lmReq(), {
      period: 'month',
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantSalesQueryDto);

    expect(merchantSalesService.summary).toHaveBeenCalledWith(
      { kind: 'establishments', establishmentIds: [ASSIGNED_ESTABLISHMENT_ID] },
      'month',
    );
  });

  it('a location manager with no assignment resolves to a scope that matches nothing', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesSummary(lmReqNoAssignment(), {
      period: 'month',
    } as MerchantSalesQueryDto);

    expect(merchantSalesService.summary).toHaveBeenCalledWith({ kind: 'none' }, 'month');
  });

  it('defaults period to month when omitted', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesSummary(merchantReq(), {} as MerchantSalesQueryDto);

    expect(merchantSalesService.summary).toHaveBeenCalledWith(expect.anything(), 'month');
  });
});

describe('OrdersController.getMerchantSalesChart - scope resolution (A12)', () => {
  it('a location manager is pinned to their own assignment here too, ignoring a different establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesChart(lmReq(), {
      period: '7d',
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantSalesQueryDto);

    expect(merchantSalesService.chart).toHaveBeenCalledWith(
      { kind: 'establishments', establishmentIds: [ASSIGNED_ESTABLISHMENT_ID] },
      '7d',
    );
  });

  it('a merchant is scoped to the establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();
    await controller.getMerchantSalesChart(merchantReq(), {
      period: '7d',
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantSalesQueryDto);

    expect(merchantSalesService.chart).toHaveBeenCalledWith(
      { kind: 'merchant', merchantId: MERCHANT_ID, establishmentId: OTHER_ESTABLISHMENT_ID },
      '7d',
    );
  });
});
