/**
 * CRITICAL 1 fix (task-15-fix1-findings.md): `commission` must never be part
 * of the shared `ORDER_DETAIL_FIELDS` projection that every `findById` caller
 * shares, including CONSUMER-reachable paths (`confirm-pickup`, `cancel`
 * have no `@Roles` guard at all). It is loaded only through the explicit
 * `includeCommission` opt-in, which a caller may only set when it already
 * knows the requester is MERCHANT, LOCATION_MANAGER or ADMIN
 * (`canSeeCommission`).
 *
 * This drives the REAL `OrdersService.findById` (only `orderModel.aggregate`
 * is mocked) so a regression that widens `ORDER_DETAIL_FIELDS` again - or
 * that removes the `includeCommission` gate - fails here, not only at the
 * controller layer where `forRole`/`toMerchantOrderView` provide a second,
 * separate line of defence.
 */
import { UserRole } from '@foodwaste/shared';

import { OrdersService } from '../order.service';

const ORDER_ID = '507f1f77bcf86cd799439011';
const CUSTOMER_ID = '507f1f77bcf86cd799439012';
const MERCHANT_ID = '507f1f77bcf86cd799439013';

function buildService(aggregateResult: unknown[]) {
  const exec = jest.fn().mockResolvedValue(aggregateResult);
  const aggregate = jest.fn().mockReturnValue({ exec });
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, { orderModel: { aggregate } });
  return { service, aggregate };
}

function fakeOrder() {
  return {
    _id: ORDER_ID,
    customerId: { _id: CUSTOMER_ID },
    merchantId: { _id: MERCHANT_ID },
  };
}

/** Reads the `$project` stage's field map out of the pipeline handed to `aggregate`. */
function projectedFields(aggregate: jest.Mock): Record<string, 1> {
  const pipeline = aggregate.mock.calls[0][0] as Array<{ $project?: Record<string, 1> }>;
  const projectStage = pipeline.find(stage => '$project' in stage);
  return projectStage?.$project ?? {};
}

describe('OrdersService.findById - commission projection opt-in', () => {
  it('does not project commission with no options at all', async () => {
    const { service, aggregate } = buildService([fakeOrder()]);
    await service.findById(ORDER_ID);
    expect(projectedFields(aggregate)).not.toHaveProperty('commission');
  });

  it.each([UserRole.CONSUMER, UserRole.MERCHANT, UserRole.LOCATION_MANAGER, UserRole.ADMIN])(
    'does not project commission for role %s when includeCommission is not passed',
    async role => {
      const { service, aggregate } = buildService([fakeOrder()]);
      await service.findById(ORDER_ID, CUSTOMER_ID, role);
      expect(projectedFields(aggregate)).not.toHaveProperty('commission');
    },
  );

  it('projects commission only when includeCommission: true is explicitly passed', async () => {
    const { service, aggregate } = buildService([fakeOrder()]);
    await service.findById(ORDER_ID, MERCHANT_ID, UserRole.MERCHANT, { includeCommission: true });
    expect(projectedFields(aggregate)).toHaveProperty('commission', 1);
  });

  it('projects commission for includeCommission: true regardless of role - the caller decides', async () => {
    // findById does not gate the opt-in itself; the gate is `canSeeCommission`
    // at each call site. This documents that contract so it cannot silently
    // become "any role passing the flag gets it" without a call-site check.
    const { service, aggregate } = buildService([fakeOrder()]);
    await service.findById(ORDER_ID, CUSTOMER_ID, UserRole.CONSUMER, { includeCommission: true });
    expect(projectedFields(aggregate)).toHaveProperty('commission', 1);
  });

  it('never projects commission when includeCommission is explicitly false', async () => {
    const { service, aggregate } = buildService([fakeOrder()]);
    await service.findById(ORDER_ID, MERCHANT_ID, UserRole.MERCHANT, { includeCommission: false });
    expect(projectedFields(aggregate)).not.toHaveProperty('commission');
  });

  it('still projects every other ORDER_DETAIL_FIELDS entry with the opt-in on', async () => {
    const { service, aggregate } = buildService([fakeOrder()]);
    await service.findById(ORDER_ID, MERCHANT_ID, UserRole.MERCHANT, { includeCommission: true });
    const fields = projectedFields(aggregate);
    expect(fields).toMatchObject({ orderNumber: 1, pricing: 1, status: 1, commission: 1 });
  });
});
