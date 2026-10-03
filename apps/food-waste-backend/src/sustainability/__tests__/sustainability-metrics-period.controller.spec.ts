import { UserRole } from '@foodwaste/shared';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { Establishment } from '../../establishments/schemas/establishment.schema';
import { SustainabilityController } from '../controllers/sustainability.controller';
import { FundLedgerService } from '../services/fund-ledger.service';
import { PdfReportService } from '../services/pdf-report.service';
import { StreakService } from '../services/streak.service';
import { SustainabilityService } from '../services/sustainability.service';
import { resolveSalesPeriod } from '../../merchant-sales/merchant-sales.period';

import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import type { TestingModule } from '@nestjs/testing';

/**
 * `GET /sustainability/carbon-metrics` and `.../social-impact` gained an
 * optional `period`, resolved server-side in Africa/Tunis exactly like the
 * merchant-sales summary/chart (`resolveSalesPeriod`), so the Dashboard's
 * carbon/social impact cards can follow the same period bar as earnings. The
 * older `since` param is unchanged when `period` is absent - the ESG and
 * Community pages call these endpoints with neither.
 *
 * Controller unit test (mocked `SustainabilityService`): the resolution +
 * "period wins" branching lives entirely in the controller, exactly as for
 * `OrdersController.getOrderStats` (order-stats-period.spec.ts). The service
 * only ever sees a plain `Date | undefined`, and its half - a `startDate`
 * narrows the aggregation - is already proven against a real MongoDB by the
 * existing carbon-metrics/social-impact specs' `since` coverage; this file
 * does not re-prove that, only that the controller resolves and prioritises
 * correctly for both endpoints.
 */

const MERCHANT_ID = '507f1f77bcf86cd799439011';

function request(overrides: Partial<AuthenticatedRequest['user']> = {}): AuthenticatedRequest {
  return {
    user: {
      userId: MERCHANT_ID,
      email: 'merchant@example.com',
      role: UserRole.MERCHANT,
      ...overrides,
    },
  } as AuthenticatedRequest;
}

describe.each([
  ['getCarbonMetrics', 'getCarbonMetrics'] as const,
  ['getSocialImpact', 'getSocialImpact'] as const,
])('SustainabilityController.%s — period resolution', (controllerMethod, serviceMethod) => {
  let controller: SustainabilityController;
  let sustainabilityService: Record<string, jest.Mock>;

  beforeEach(async () => {
    sustainabilityService = {
      getCarbonMetrics: jest.fn().mockResolvedValue({}),
      getSocialImpact: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SustainabilityController],
      providers: [
        { provide: SustainabilityService, useValue: sustainabilityService },
        { provide: FundLedgerService, useValue: {} },
        { provide: PdfReportService, useValue: {} },
        { provide: StreakService, useValue: {} },
        { provide: getModelToken(Establishment.name), useValue: {} },
      ],
    }).compile();

    controller = module.get<SustainabilityController>(SustainabilityController);
  });

  const call = async (query: Record<string, unknown>): Promise<unknown> => {
    const method = (
      controller as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
    )[controllerMethod];
    if (!method) {
      throw new Error(`missing controller method ${controllerMethod}`);
    }
    const result = await method.call(controller, request(), query);
    return result;
  };

  /** The `startDate` (second positional arg) the service was last called with. */
  const lastStartDate = (): Date | undefined => {
    const calls = sustainabilityService[serviceMethod]?.mock.calls ?? [];
    const lastCall = calls[calls.length - 1] as unknown[] | undefined;
    return lastCall?.[1] as Date | undefined;
  };

  it('resolves `period` into the same `from` boundary the earnings summary/chart use', async () => {
    const before = Date.now();
    await call({ period: '7d' });
    const after = Date.now();

    const startDate = lastStartDate();
    const expectedEarliest = resolveSalesPeriod('7d', new Date(before)).from;
    const expectedLatest = resolveSalesPeriod('7d', new Date(after)).from;
    expect(startDate).toEqual(expectedEarliest);
    expect(startDate).toEqual(expectedLatest);
  });

  it('`period` wins when both `period` and `since` are sent', async () => {
    await call({ period: 'today', since: '2020-01-01T00:00:00.000Z' });

    expect(lastStartDate()?.toISOString().startsWith('2020-01-01')).toBe(false);
  });

  it('falls back to `since` when `period` is absent (ESG/Community pages, unchanged)', async () => {
    await call({ since: '2020-01-01T00:00:00.000Z' });

    expect(lastStartDate()).toEqual(new Date('2020-01-01T00:00:00.000Z'));
  });

  it('passes no lower bound when neither `period` nor `since` is sent (unchanged)', async () => {
    await call({});

    expect(lastStartDate()).toBeUndefined();
  });

  it("resolves `period: 'all'` to no lower bound too", async () => {
    await call({ period: 'all' });

    expect(lastStartDate()).toBeUndefined();
  });
});
