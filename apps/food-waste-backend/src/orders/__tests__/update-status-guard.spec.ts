/**
 * `PATCH /orders/:id/status` - the generic status write.
 *
 * It had no role guard, so any signed-in user could call it, and it allowed
 * every move in the transition map. A consumer could mark their own order
 * PICKED_UP without a pickup code, or REFUNDED after pickup, skipping the
 * commission, the wallet, the ledgers, loyalty and the charity contribution.
 *
 * Now: merchant or admin only, and only the two moves that carry no money.
 */

import { BadRequestException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@foodwaste/shared';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { OrdersController } from '../order.controller';
import { OrdersService } from '../order.service';

describe('PATCH /orders/:id/status', () => {
  it('is restricted to merchants and admins', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      OrdersController.prototype.updateStatus,
    ) as UserRole[];

    expect(roles).toEqual(expect.arrayContaining([UserRole.MERCHANT, UserRole.ADMIN]));
    expect(roles).not.toContain(UserRole.CONSUMER);
    expect(roles).not.toContain(UserRole.DRIVER);
  });

  describe('OrdersService.updateStatus', () => {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const findById = jest.fn();
    Object.assign(service, { findById });

    beforeEach(() => {
      findById.mockReset();
      // Stops the call right after the gate; what follows is not under test.
      findById.mockRejectedValue(new Error('past the gate'));
    });

    it.each([
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DRIVER_ASSIGNED,
    ])('refuses to write %s directly, for any role, before reading the order', async status => {
      for (const role of [UserRole.ADMIN, UserRole.MERCHANT]) {
        await expect(
          service.updateStatus('507f1f77bcf86cd799439011', { status } as never, 'u', role),
        ).rejects.toThrow(BadRequestException);
      }
      expect(findById).not.toHaveBeenCalled();
    });

    it.each([OrderStatus.CONFIRMED, OrderStatus.READY_FOR_PICKUP])(
      'lets %s through to the ownership and transition checks',
      async status => {
        await expect(
          service.updateStatus(
            '507f1f77bcf86cd799439011',
            { status } as never,
            'u',
            UserRole.MERCHANT,
          ),
        ).rejects.toThrow('past the gate');
        expect(findById).toHaveBeenCalled();
      },
    );
  });
});
