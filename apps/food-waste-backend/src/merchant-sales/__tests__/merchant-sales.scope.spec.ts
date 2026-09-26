import { UserRole } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { salesScopeFor, scopeMatch } from '../merchant-sales.scope';

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

  it.each([UserRole.CONSUMER, UserRole.ADMIN, UserRole.MODERATOR])('%s sees nothing here', role => {
    expect(scopeMatch(salesScopeFor(role, merchant))).toBeNull();
  });

  it('a merchant passing an invalid establishment id is a 400, not a silent widen', () => {
    expect(() => salesScopeFor(UserRole.MERCHANT, merchant, 'bad')).toThrow(BadRequestException);
  });

  it('an establishment list scope matches exactly those ids, and an empty list is nothing', () => {
    expect(scopeMatch({ kind: 'establishments', establishmentIds: [est] })).toEqual({
      establishmentId: { $in: [new Types.ObjectId(est)] },
    });
    expect(scopeMatch({ kind: 'establishments', establishmentIds: [] })).toBeNull();
  });
});
