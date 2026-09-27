/**
 * POST /analytics/business-metrics over real HTTP - proves a client cannot
 * inject `resolvedFromPeriod` (Task 14, fix round 2, item 2). The flag only
 * ever exists on the internal `BusinessMetricsRequestDto & ResolvedPeriodFlag`
 * intersection the controller builds itself in `resolvePeriod` - it is never
 * a declared `BusinessMetricsRequestDto` property. The production
 * ValidationPipe (whitelist + forbidNonWhitelisted, built exactly as
 * `main.ts` builds it - see `error-http.spec.ts` for the same pattern) must
 * reject the whole request before the controller method, let alone the
 * service, ever runs.
 *
 * A real Nest app on a random port; guards overridden the way
 * `business-metrics-scoping.spec.ts` reasons about them - auth/subscription/
 * role checks are a request-pipeline concern unrelated to this test, so they
 * are stubbed to always allow, and the service is mocked so a call to it is
 * observable.
 */
import { UserRole } from '@foodwaste/shared';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { createAppValidationPipe } from '../../../common/errors/validation-pipe';
import { ProSubscriptionGuard } from '../../../common/guards/pro-subscription.guard';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsController } from '../analytics.controller';

const call = async (
  base: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> => {
  const res = await fetch(`${base}/analytics/business-metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
};

describe('POST /analytics/business-metrics — resolvedFromPeriod cannot be injected', () => {
  let app: INestApplication;
  let base: string;
  let analyticsService: {
    resolveEffectiveEstablishmentIds: jest.Mock;
    emptyBusinessMetrics: jest.Mock;
    getBusinessMetrics: jest.Mock;
  };

  beforeAll(async () => {
    analyticsService = {
      resolveEffectiveEstablishmentIds: jest.fn().mockResolvedValue(['owned-a']),
      emptyBusinessMetrics: jest.fn(),
      getBusinessMetrics: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: analyticsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        // The route handler reads `req.user.userId` before anything else -
        // attach a user the way the real guard would, or a request that
        // *does* reach the controller 500s for an unrelated reason.
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'merchant-1', email: 'm@example.com', role: UserRole.MERCHANT };
          return true;
        },
      })
      .overrideGuard(ProSubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    // The same global pipe main.ts installs (createAppValidationPipe) -
    // whitelist + forbidNonWhitelisted + transform. The controller also
    // carries its own `@UsePipes(strictValidation())` with the same options;
    // running both is exactly what production does and is harmless here.
    app.useGlobalPipes(createAppValidationPipe());
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    analyticsService.getBusinessMetrics.mockClear();
    analyticsService.resolveEffectiveEstablishmentIds.mockClear();
  });

  it('rejects a body carrying resolvedFromPeriod with 400 and never reaches the service - even paired with a custom range over 2 years', async () => {
    const { status, json } = await call(base, {
      filters: {
        // Over 2 years - exactly the range `resolvedFromPeriod: true` would
        // need to smuggle past the cap if the injection worked.
        dateRange: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2023-06-01T00:00:00.000Z' },
        granularity: { period: 'day' },
      },
      resolvedFromPeriod: true,
    });

    expect(status).toBe(400);
    expect(json['code']).toBe('VALIDATION_FAILED');
    // The request never made it past the pipe: neither the establishment
    // resolver nor the service was ever called.
    expect(analyticsService.resolveEffectiveEstablishmentIds).not.toHaveBeenCalled();
    expect(analyticsService.getBusinessMetrics).not.toHaveBeenCalled();
  });

  it('the same body without the injected flag is still just a validation-shaped 400 (sanity: forbidNonWhitelisted is what rejects it)', async () => {
    // Without `resolvedFromPeriod`, this body is well-formed - it reaches the
    // controller and the (mocked) service, proving the previous test's 400
    // comes specifically from the extra property, not from anything else in
    // the payload.
    const { status } = await call(base, {
      filters: {
        dateRange: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2023-06-01T00:00:00.000Z' },
        granularity: { period: 'day' },
      },
    });

    expect(status).toBe(200);
    expect(analyticsService.getBusinessMetrics).toHaveBeenCalledTimes(1);
  });
});
