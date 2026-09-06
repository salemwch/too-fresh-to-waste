import { UserRole } from '@foodwaste/shared';
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { Establishment } from '../../establishments/schemas/establishment.schema';
import { SustainabilityController } from '../controllers/sustainability.controller';
import { FundLedgerService } from '../services/fund-ledger.service';
import { PdfReportService } from '../services/pdf-report.service';
import { StreakService } from '../services/streak.service';
import { SustainabilityService } from '../services/sustainability.service';

import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import type { FundLedgerResponse } from '../dto/sustainability.dto';
import type { TestingModule } from '@nestjs/testing';

/**
 * The seam between the controller and the ledger service.
 *
 * The card test mocks the hook and the aggregation tests feed hand-built rows
 * to pure functions, so nothing else in the repo asserts what the handler
 * returns or what it passes down. Renaming a field on the response, or
 * handing the service the wrong id for a location manager, would otherwise
 * leave every backend and web suite green while the dashboard renders an
 * empty state in production.
 */

const MERCHANT_ID = '507f1f77bcf86cd799439011';
const MANAGER_ID = '507f1f77bcf86cd799439012';
const OWNER_ID = '507f1f77bcf86cd799439013';
const ASSIGNED_ESTABLISHMENT_ID = '507f1f77bcf86cd799439014';

const LEDGER: FundLedgerResponse = {
  totalTnd: 47.35,
  currency: 'TND',
  contributionCount: 12,
  items: [],
  totalItems: 0,
  firstContributionAt: '2026-03-01T00:00:00.000Z',
};

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

describe('SustainabilityController.getFundLedger', () => {
  let controller: SustainabilityController;
  let fundLedgerService: {
    getFundLedger: jest.Mock;
    resolveEstablishmentOwnerId: jest.Mock;
  };

  beforeEach(async () => {
    fundLedgerService = {
      getFundLedger: jest.fn().mockResolvedValue(LEDGER),
      resolveEstablishmentOwnerId: jest.fn().mockResolvedValue(OWNER_ID),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SustainabilityController],
      providers: [
        { provide: FundLedgerService, useValue: fundLedgerService },
        { provide: SustainabilityService, useValue: {} },
        { provide: PdfReportService, useValue: {} },
        { provide: StreakService, useValue: {} },
        // The controller carries a class-level ProSubscriptionGuard, which
        // Nest instantiates with the module. It reads the establishment model
        // only inside canActivate, which no test here invokes - these handler
        // calls bypass the guard chain entirely.
        { provide: getModelToken(Establishment.name), useValue: {} },
      ],
    }).compile();

    controller = module.get<SustainabilityController>(SustainabilityController);
  });

  describe('envelope', () => {
    it('returns the service payload under `data`, beside a message', async () => {
      // Web reads response.data.data, so the payload must sit one level under
      // `data` here and must not be reshaped, spread or renamed on the way
      // out. `toEqual` on the whole return value catches an added or dropped
      // key as well as a moved one.
      const result = await controller.getFundLedger(request());

      expect(result).toEqual({
        message: 'Fund ledger retrieved successfully',
        data: LEDGER,
      });
      // The exact field names the card reads. A backend-side rename of
      // totalTnd or firstContributionAt fails here rather than silently
      // rendering the empty state.
      expect(Object.keys(result.data).sort()).toEqual([
        'contributionCount',
        'currency',
        'firstContributionAt',
        'items',
        'totalItems',
        'totalTnd',
      ]);
    });
  });

  describe('MERCHANT', () => {
    it('reads the ledger as the caller, with no establishment filter by default', async () => {
      await controller.getFundLedger(request());

      expect(fundLedgerService.getFundLedger).toHaveBeenCalledWith(MERCHANT_ID, undefined);
      expect(fundLedgerService.resolveEstablishmentOwnerId).not.toHaveBeenCalled();
    });

    it('passes the establishmentId query param through, still scoped to the caller', async () => {
      await controller.getFundLedger(request(), ASSIGNED_ESTABLISHMENT_ID);

      // The first argument is what scopes the query to one merchant. A
      // spoofed establishmentId narrows the result, it can never widen it to
      // another merchant's donations.
      expect(fundLedgerService.getFundLedger).toHaveBeenCalledWith(
        MERCHANT_ID,
        ASSIGNED_ESTABLISHMENT_ID,
      );
    });
  });

  describe('LOCATION_MANAGER', () => {
    it('reads the ledger as the establishment owner, not as the manager', async () => {
      // Donations carry merchantId = establishment.ownerId. Passing the
      // manager's own userId matches zero rows for every location manager,
      // always - a false empty state, not a data leak.
      await controller.getFundLedger(
        request({
          userId: MANAGER_ID,
          role: UserRole.LOCATION_MANAGER,
          assignedEstablishmentId: ASSIGNED_ESTABLISHMENT_ID,
        }),
      );

      expect(fundLedgerService.resolveEstablishmentOwnerId).toHaveBeenCalledWith(
        ASSIGNED_ESTABLISHMENT_ID,
      );
      expect(fundLedgerService.getFundLedger).toHaveBeenCalledWith(
        OWNER_ID,
        ASSIGNED_ESTABLISHMENT_ID,
      );
      const [passedMerchantId] = fundLedgerService.getFundLedger.mock.calls[0] as [string];
      expect(passedMerchantId).not.toBe(MANAGER_ID);
    });

    it('ignores an establishmentId query param and uses the assigned one', async () => {
      const OTHER_ESTABLISHMENT_ID = '507f1f77bcf86cd799439099';

      await controller.getFundLedger(
        request({
          userId: MANAGER_ID,
          role: UserRole.LOCATION_MANAGER,
          assignedEstablishmentId: ASSIGNED_ESTABLISHMENT_ID,
        }),
        OTHER_ESTABLISHMENT_ID,
      );

      expect(fundLedgerService.resolveEstablishmentOwnerId).toHaveBeenCalledWith(
        ASSIGNED_ESTABLISHMENT_ID,
      );
      expect(fundLedgerService.getFundLedger).toHaveBeenCalledWith(
        OWNER_ID,
        ASSIGNED_ESTABLISHMENT_ID,
      );
    });

    it('refuses when the assigned establishment has no resolvable owner', async () => {
      // Deleted or malformed establishment. Reading on unresolved scope would
      // either show the whole organisation (leak) or an empty ledger (lie),
      // so the request is refused instead.
      fundLedgerService.resolveEstablishmentOwnerId.mockResolvedValue(null);

      await expect(
        controller.getFundLedger(
          request({
            userId: MANAGER_ID,
            role: UserRole.LOCATION_MANAGER,
            assignedEstablishmentId: ASSIGNED_ESTABLISHMENT_ID,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(fundLedgerService.getFundLedger).not.toHaveBeenCalled();
    });

    it('refuses when the manager has no assigned establishment at all', async () => {
      await expect(
        controller.getFundLedger(request({ userId: MANAGER_ID, role: UserRole.LOCATION_MANAGER })),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(fundLedgerService.resolveEstablishmentOwnerId).not.toHaveBeenCalled();
      expect(fundLedgerService.getFundLedger).not.toHaveBeenCalled();
    });

    it('refuses with user-facing copy, never a technical instruction', async () => {
      fundLedgerService.resolveEstablishmentOwnerId.mockResolvedValue(null);

      const error = await controller
        .getFundLedger(
          request({
            userId: MANAGER_ID,
            role: UserRole.LOCATION_MANAGER,
            assignedEstablishmentId: ASSIGNED_ESTABLISHMENT_ID,
          }),
        )
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      const message = (error as NotFoundException).message;
      // .claude/rules/backend.md rule 12: these strings reach the merchant.
      expect(message).not.toMatch(/ownerId|ObjectId|establishmentId|null|undefined|admin/i);
      expect(message.length).toBeGreaterThan(20);
    });
  });
});
