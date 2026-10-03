import { UserRole } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';

import { appError } from '../common/errors';

export type SalesScope =
  | { kind: 'merchant'; merchantId: string; establishmentId?: string }
  | { kind: 'establishments'; establishmentIds: string[] }
  | { kind: 'none' };

/**
 * Who the figures are about. There is deliberately no "all orders" scope: the
 * old chart fell through to `{}` for a location manager without an
 * assignment and showed every merchant's revenue.
 */
export function salesScopeFor(
  role: UserRole,
  userId: string,
  establishmentId?: string,
): SalesScope {
  if (role === UserRole.LOCATION_MANAGER) {
    return establishmentId && isValidObjectId(establishmentId)
      ? { kind: 'establishments', establishmentIds: [establishmentId] }
      : { kind: 'none' };
  }
  if (role === UserRole.MERCHANT) {
    if (establishmentId !== undefined && !isValidObjectId(establishmentId)) {
      throw new BadRequestException(appError('INVALID_ID'));
    }
    return {
      kind: 'merchant',
      merchantId: userId,
      ...(establishmentId ? { establishmentId } : {}),
    };
  }
  return { kind: 'none' };
}

/** The requester fields every sales/payments endpoint reads off `req.user`. */
export interface SalesScopeRequester {
  role: UserRole;
  userId: string;
  assignedEstablishmentId?: string;
}

/**
 * The one place a LOCATION_MANAGER is pinned to their own assignment,
 * whatever `establishmentId` the query string carries - used by
 * `OrdersController.salesScope` (summary/chart) and
 * `PaymentController.getPaymentStats`/`getMyPayments`, so the pin cannot
 * drift between endpoints (A3, A12).
 */
export function salesScopeForRequest(
  user: SalesScopeRequester,
  requestedEstablishmentId?: string,
): SalesScope {
  const establishmentId =
    user.role === UserRole.LOCATION_MANAGER
      ? user.assignedEstablishmentId
      : requestedEstablishmentId;
  return salesScopeFor(user.role, user.userId, establishmentId ?? undefined);
}

export function scopeMatch(scope: SalesScope): Record<string, unknown> | null {
  switch (scope.kind) {
    case 'merchant':
      return {
        merchantId: new Types.ObjectId(scope.merchantId),
        ...(scope.establishmentId
          ? { establishmentId: new Types.ObjectId(scope.establishmentId) }
          : {}),
      };
    case 'establishments':
      return scope.establishmentIds.length > 0
        ? { establishmentId: { $in: scope.establishmentIds.map(id => new Types.ObjectId(id)) } }
        : null;
    case 'none':
      return null;
  }
}
