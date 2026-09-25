/**
 * Checkout is the one route that replaces the global error filter, and it
 * does so on `POST /orders` only. OrderExceptionFilter returns the same
 * envelope plus the legacy fields installed apps read (see its spec); any other
 * route here gets AllExceptionsFilter's code + localized message.
 */

import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';

import { OrdersController } from '../../order.controller';
import { OrderExceptionFilter } from '../order-exception.filter';

const filtersOn = (target: object): unknown[] =>
  (Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, target) as unknown[] | undefined) ?? [];

describe('OrdersController exception filters', () => {
  it('uses OrderExceptionFilter on POST /orders, and nowhere else', () => {
    expect(filtersOn(OrdersController)).toEqual([]);
    const prototype = OrdersController.prototype as unknown as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler === 'function') {
        expect({ name, filters: filtersOn(handler) }).toEqual({
          name,
          filters: name === 'create' ? [OrderExceptionFilter] : [],
        });
      }
    }
  });
});
