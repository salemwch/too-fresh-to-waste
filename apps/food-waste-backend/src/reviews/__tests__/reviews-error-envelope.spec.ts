/**
 * /reviews answers errors with the global envelope.
 *
 * AllExceptionsFilter is what gives every error a stable `code` and a message
 * in the requester's language. The controller used to replace it with
 * `@UseFilters(GlobalExceptionFilter)`, which sent `message: getResponse()` -
 * once throw sites moved to appError that was an object `{code, message}`, in
 * English, with no top-level `code`. A controller- or method-level filter here
 * would silently bring that back.
 */

import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';

import { ReviewsController } from '../reviews.controller';

const filtersOn = (target: object): unknown[] =>
  (Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, target) as unknown[] | undefined) ?? [];

describe('ReviewsController', () => {
  it('declares no exception filter of its own, on the class or any handler', () => {
    expect(filtersOn(ReviewsController)).toEqual([]);
    const prototype = ReviewsController.prototype as unknown as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler === 'function') {
        expect({ name, filters: filtersOn(handler) }).toEqual({ name, filters: [] });
      }
    }
  });
});
