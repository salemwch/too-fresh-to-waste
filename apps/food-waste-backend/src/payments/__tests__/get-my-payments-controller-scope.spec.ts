/**
 * Task 17 (A12, Lens 4 #3) - security-relevant controller seam.
 *
 * `PaymentController.getMyPayments` defaults (`tab ?? 'earnings'`,
 * `limit ?? 20`) and its LOCATION_MANAGER pin were never executed by any
 * test: `merchant-sales.scope.spec.ts` tests the pure `salesScopeFor`
 * function with the id already chosen, and
 * `merchant-sales.integration.spec.ts` calls `MerchantSalesService.rows`
 * directly, never through this controller. A regression that used
 * `query.establishmentId` for every role would let a location manager read
 * any establishment's payment rows by passing its id, and nothing would fail.
 */
import { UserRole } from '@foodwaste/shared';
import { Types } from 'mongoose';

import { PaymentController } from '../payments.controller';

import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import type { MerchantEarningsRowsQueryDto } from '../../merchant-sales/dto/merchant-sales-query.dto';

const MERCHANT_ID = new Types.ObjectId().toString();
const ASSIGNED_ESTABLISHMENT_ID = new Types.ObjectId().toString();
const OTHER_ESTABLISHMENT_ID = new Types.ObjectId().toString();

function buildController() {
  const merchantSalesService = { rows: jest.fn().mockResolvedValue({ rows: [], hasMore: false }) };
  const controller = Object.create(PaymentController.prototype) as PaymentController;
  Object.assign(controller, { merchantSalesService });
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

describe('PaymentController.getMyPayments (A12)', () => {
  it('defaults tab to earnings and limit to 20 when the query sends neither', async () => {
    const { controller, merchantSalesService } = buildController();

    await controller.getMyPayments(merchantReq(), {} as MerchantEarningsRowsQueryDto);

    expect(merchantSalesService.rows).toHaveBeenCalledWith(
      { kind: 'merchant', merchantId: MERCHANT_ID },
      'month',
      'earnings',
      { limit: 20 },
    );
  });

  it('threads an explicit tab, period and limit through unchanged', async () => {
    const { controller, merchantSalesService } = buildController();

    await controller.getMyPayments(merchantReq(), {
      period: '7d',
      tab: 'refunded',
      limit: 5,
    } as MerchantEarningsRowsQueryDto);

    expect(merchantSalesService.rows).toHaveBeenCalledWith(
      { kind: 'merchant', merchantId: MERCHANT_ID },
      '7d',
      'refunded',
      { limit: 5 },
    );
  });

  it('a location manager is pinned to their own assignment, ignoring a different establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();

    await controller.getMyPayments(lmReq(), {
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantEarningsRowsQueryDto);

    expect(merchantSalesService.rows).toHaveBeenCalledWith(
      { kind: 'establishments', establishmentIds: [ASSIGNED_ESTABLISHMENT_ID] },
      'month',
      'earnings',
      { limit: 20 },
    );
  });

  it('a merchant is scoped to the establishmentId they send', async () => {
    const { controller, merchantSalesService } = buildController();

    await controller.getMyPayments(merchantReq(), {
      establishmentId: OTHER_ESTABLISHMENT_ID,
    } as MerchantEarningsRowsQueryDto);

    expect(merchantSalesService.rows).toHaveBeenCalledWith(
      { kind: 'merchant', merchantId: MERCHANT_ID, establishmentId: OTHER_ESTABLISHMENT_ID },
      'month',
      'earnings',
      { limit: 20 },
    );
  });

  it('threads the cursor only when the query sends one', async () => {
    const { controller, merchantSalesService } = buildController();

    await controller.getMyPayments(merchantReq(), {
      after: 'cursor-1',
    } as MerchantEarningsRowsQueryDto);

    expect(merchantSalesService.rows).toHaveBeenCalledWith(expect.anything(), 'month', 'earnings', {
      after: 'cursor-1',
      limit: 20,
    });
  });
});
