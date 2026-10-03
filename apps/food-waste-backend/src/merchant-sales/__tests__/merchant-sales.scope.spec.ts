import { UserRole } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { hasErrorCode } from '../../common/errors';
import { salesScopeFor, salesScopeForRequest, scopeMatch } from '../merchant-sales.scope';

const merchant = new Types.ObjectId().toString();
const est = new Types.ObjectId().toString();

describe('salesScopeFor / scopeMatch', () => {
  it('a merchant sees their own orders, optionally one establishment', () => {
    expect(scopeMatch(salesScopeFor(UserRole.MERCHANT, merchant))).toEqual({
      merchantId: new Types.ObjectId(merchant),
    });
    expect(scopeMatch(salesScopeFor(UserRole.MERCHANT, merchant, est))).toEqual({
      merchantId: new Types.ObjectId(merchant),
      establishmentId: new Types.ObjectId(est),
    });
  });

  it('a location manager sees only the assigned establishment', () => {
    expect(scopeMatch(salesScopeFor(UserRole.LOCATION_MANAGER, 'u', est))).toEqual({
      establishmentId: { $in: [new Types.ObjectId(est)] },
    });
  });

  it.each([undefined, 'not-an-id'])(
    'a location manager without a valid assignment sees nothing (was: every merchant) - %p',
    assignment => {
      expect(scopeMatch(salesScopeFor(UserRole.LOCATION_MANAGER, 'u', assignment))).toBeNull();
    },
  );

  it.each([UserRole.CONSUMER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.DRIVER])(
    '%s sees nothing here',
    role => {
      expect(scopeMatch(salesScopeFor(role, merchant))).toBeNull();
    },
  );

  it('a merchant passing an invalid establishment id is a 400, not a silent widen', () => {
    let thrown: unknown;
    try {
      salesScopeFor(UserRole.MERCHANT, merchant, 'bad');
      fail('should have thrown');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect(hasErrorCode(thrown, 'INVALID_ID')).toBe(true);
  });

  it('an establishment list scope matches exactly those ids, and an empty list is nothing', () => {
    expect(scopeMatch({ kind: 'establishments', establishmentIds: [est] })).toEqual({
      establishmentId: { $in: [new Types.ObjectId(est)] },
    });
    expect(scopeMatch({ kind: 'establishments', establishmentIds: [] })).toBeNull();
  });
});

describe('salesScopeForRequest (A3/A12: the one place every sales/payments endpoint pins a LOCATION_MANAGER)', () => {
  const otherEst = new Types.ObjectId().toString();

  it('a location manager is pinned to their assignment, whatever establishmentId they send', () => {
    const user = { role: UserRole.LOCATION_MANAGER, userId: 'u', assignedEstablishmentId: est };
    expect(scopeMatch(salesScopeForRequest(user, otherEst))).toEqual({
      establishmentId: { $in: [new Types.ObjectId(est)] },
    });
  });

  it('a location manager with no assignment sees nothing, even if they send an establishmentId', () => {
    const user = { role: UserRole.LOCATION_MANAGER, userId: 'u' };
    expect(scopeMatch(salesScopeForRequest(user, otherEst))).toBeNull();
  });

  it('a merchant is scoped to whatever establishmentId they send', () => {
    const user = { role: UserRole.MERCHANT, userId: merchant };
    expect(scopeMatch(salesScopeForRequest(user, est))).toEqual({
      merchantId: new Types.ObjectId(merchant),
      establishmentId: new Types.ObjectId(est),
    });
  });

  it('a merchant with no establishmentId sees every establishment they own', () => {
    const user = { role: UserRole.MERCHANT, userId: merchant };
    expect(scopeMatch(salesScopeForRequest(user))).toEqual({
      merchantId: new Types.ObjectId(merchant),
    });
  });
});
