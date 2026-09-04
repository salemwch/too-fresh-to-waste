/**
 * `POST /analytics/business-metrics` used to trust the client-supplied
 * `establishmentIds` outright and treat an empty list as "no filter" (i.e.
 * platform-wide data) — a merchant with no `activeEstablishmentId` set, or
 * one who supplied someone else's establishment id, saw data that wasn't
 * theirs. These tests pin the fix: `resolveEffectiveEstablishmentIds` never
 * returns anything the caller doesn't own, and "owns nothing matching" never
 * resolves to an unfiltered (empty-array) query.
 */

import { UserRole } from '@foodwaste/shared';
import { Types } from 'mongoose';

import { AnalyticsService } from '../analytics.service';

const buildService = (ownedEstablishmentIds: string[]) => {
  const establishmentModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(ownedEstablishmentIds.map(id => ({ _id: new Types.ObjectId(id) }))),
      }),
    }),
  };

  const service = Object.create(AnalyticsService.prototype) as AnalyticsService;
  Object.assign(service, { establishmentModel });

  return { service, establishmentModel };
};

const OWNED_A = new Types.ObjectId().toString();
const OWNED_B = new Types.ObjectId().toString();
const FOREIGN = new Types.ObjectId().toString();
const MERCHANT_ID = new Types.ObjectId().toString();

describe('AnalyticsService.resolveEffectiveEstablishmentIds', () => {
  describe('MERCHANT role', () => {
    it('defaults to every establishment the merchant owns when none are requested', async () => {
      const { service, establishmentModel } = buildService([OWNED_A, OWNED_B]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.MERCHANT,
        null,
        undefined,
      );

      expect(result.sort()).toEqual([OWNED_A, OWNED_B].sort());
      expect(establishmentModel.find).toHaveBeenCalledWith({
        ownerId: expect.any(Types.ObjectId),
      });
    });

    it('narrows to the requested subset when the caller owns it', async () => {
      const { service } = buildService([OWNED_A, OWNED_B]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.MERCHANT,
        null,
        [OWNED_A],
      );

      expect(result).toEqual([OWNED_A]);
    });

    it('does not let the caller read an establishment they do not own — falls back to their own set, not the foreign id', async () => {
      const { service } = buildService([OWNED_A, OWNED_B]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.MERCHANT,
        null,
        [FOREIGN],
      );

      expect(result).not.toContain(FOREIGN);
      expect(result.sort()).toEqual([OWNED_A, OWNED_B].sort());
    });

    it('mixed request (one owned, one foreign) keeps only the owned one, not the foreign one', async () => {
      const { service } = buildService([OWNED_A, OWNED_B]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.MERCHANT,
        null,
        [OWNED_A, FOREIGN],
      );

      expect(result).toEqual([OWNED_A]);
    });

    it('returns an empty array — never an unfiltered query — for a merchant who owns no establishments', async () => {
      const { service } = buildService([]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.MERCHANT,
        null,
        undefined,
      );

      expect(result).toEqual([]);
    });
  });

  describe('LOCATION_MANAGER role', () => {
    it('is scoped to their single assigned establishment, ignoring any requested ids', async () => {
      const { service, establishmentModel } = buildService([OWNED_A]);
      const assigned = new Types.ObjectId().toString();

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.LOCATION_MANAGER,
        assigned,
        [FOREIGN],
      );

      expect(result).toEqual([assigned]);
      // Never resolves ownership via the merchant establishment lookup —
      // location managers are scoped by assignment, not ownership.
      expect(establishmentModel.find).not.toHaveBeenCalled();
    });

    it('returns an empty array when no establishment is assigned', async () => {
      const { service } = buildService([]);

      const result = await service.resolveEffectiveEstablishmentIds(
        MERCHANT_ID,
        UserRole.LOCATION_MANAGER,
        null,
        undefined,
      );

      expect(result).toEqual([]);
    });
  });
});

describe('AnalyticsService.emptyBusinessMetrics', () => {
  it('returns a fully zero-valued, well-formed BusinessMetrics — not a partial/undefined shape', () => {
    const { service } = buildService([]);

    const result = service.emptyBusinessMetrics();

    expect(result.totalRevenue).toEqual({ value: 0, trend: 'stable' });
    expect(result.totalEarnings).toEqual({ value: 0, trend: 'stable' });
    expect(result.totalOrders).toEqual({ value: 0, trend: 'stable' });
    expect(result.averageOrderValue).toEqual({ value: 0, trend: 'stable' });
    expect(result.conversionRate).toEqual({ value: 0, trend: 'stable' });
  });
});
