import { UserRole } from '@foodwaste/shared';

import type { AuthenticatedRequest } from '../../../common/decorators/get-user.decorator';
import { AnalyticsController } from '../analytics.controller';
import { AnalyticsService } from '../../services/analytics.service';

describe('AnalyticsController.getBusinessMetrics — establishment scoping wiring', () => {
  let controller: AnalyticsController;
  let analyticsService: {
    resolveEffectiveEstablishmentIds: jest.Mock;
    emptyBusinessMetrics: jest.Mock;
    getBusinessMetrics: jest.Mock;
  };

  const baseRequest = {
    filters: {
      dateRange: { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z' },
      granularity: { period: 'day' as const },
      establishmentIds: ['someone-elses-id'],
    },
  };

  const authedReq = (overrides: Partial<AuthenticatedRequest['user']>) =>
    ({
      user: {
        userId: 'merchant-1',
        email: 'm@example.com',
        role: UserRole.MERCHANT,
        ...overrides,
      },
    }) as unknown as AuthenticatedRequest;

  beforeEach(() => {
    analyticsService = {
      resolveEffectiveEstablishmentIds: jest.fn(),
      emptyBusinessMetrics: jest.fn(),
      getBusinessMetrics: jest.fn(),
    };

    // Plain instantiation, not a NestJS testing module: guards attached via
    // @UseGuards are request-pipeline concerns that never execute on a
    // direct method call, and pulling them into the DI container here would
    // require stubbing their own unrelated dependencies for no test value.
    controller = new AnalyticsController(analyticsService as unknown as AnalyticsService);
  });

  it('short-circuits to the zero-valued response and never calls the aggregation when the effective set is empty', async () => {
    analyticsService.resolveEffectiveEstablishmentIds.mockResolvedValue([]);
    const zero = { totalRevenue: { value: 0, trend: 'stable' } };
    analyticsService.emptyBusinessMetrics.mockReturnValue(zero);

    const result = await controller.getBusinessMetrics(baseRequest, authedReq({}));

    expect(result).toBe(zero);
    expect(analyticsService.getBusinessMetrics).not.toHaveBeenCalled();
  });

  it('overwrites the client-supplied establishmentIds with the resolved, ownership-checked set before calling the aggregation', async () => {
    analyticsService.resolveEffectiveEstablishmentIds.mockResolvedValue(['owned-a', 'owned-b']);
    const metrics = { totalRevenue: { value: 100, trend: 'up' } };
    analyticsService.getBusinessMetrics.mockResolvedValue(metrics);

    const result = await controller.getBusinessMetrics(baseRequest, authedReq({}));

    expect(result).toBe(metrics);
    expect(analyticsService.getBusinessMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ establishmentIds: ['owned-a', 'owned-b'] }),
      }),
    );
    // The client-supplied foreign id must never reach the aggregation layer.
    const calledWith = analyticsService.getBusinessMetrics.mock.calls[0][0];
    expect(calledWith.filters.establishmentIds).not.toContain('someone-elses-id');
  });

  it('passes the authenticated userId, role, and assignedEstablishmentId through to the resolver — never the request body', async () => {
    analyticsService.resolveEffectiveEstablishmentIds.mockResolvedValue(['owned-a']);
    analyticsService.getBusinessMetrics.mockResolvedValue({});

    await controller.getBusinessMetrics(
      baseRequest,
      authedReq({ role: UserRole.LOCATION_MANAGER, assignedEstablishmentId: 'assigned-1' }),
    );

    expect(analyticsService.resolveEffectiveEstablishmentIds).toHaveBeenCalledWith(
      'merchant-1',
      UserRole.LOCATION_MANAGER,
      'assigned-1',
      ['someone-elses-id'],
    );
  });
});
