/**
 * Enterprise-Grade Query Optimization Utilities
 *
 * Provides centralized field selection configurations and query optimization helpers
 * to prevent N+1 queries, reduce network payload, and improve database performance.
 *
 * Key Benefits:
 * 1. `.lean()` - Returns plain JavaScript objects (10-15% faster, 50% less memory)
 * 2. `.select()` - Only fetches required fields (reduces network payload by 60-80%)
 * 3. Consistent field exclusions across all services
 *
 * References:
 * - Mongoose Lean: https://mongoosejs.com/docs/tutorials/lean.html
 * - Query Selection: https://mongoosejs.com/docs/api/query.html#Query.prototype.select()
 */

/**
 * Fields to ALWAYS exclude from User queries (security + performance)
 * Prevents accidental exposure of sensitive data
 */
export const USER_EXCLUDED_FIELDS = [
  '-password',
  '-refreshTokens',
  '-emailVerificationToken',
  '-phoneVerificationCode',
  '-passwordResetToken',
  '-mfaSettings.methods.secret', // Exclude MFA secrets but keep other MFA data
  '-mfaSettings.backupCodes',
  '-mfaSettings.emergencyTokens',
  '-securitySettings.passwordHistory', // Don't expose password history
].join(' ');

/**
 * User fields for public display (profile cards, reviews, comments)
 * Minimal data to reduce payload size
 */
export const USER_PUBLIC_FIELDS = 'firstName lastName avatar email';

/**
 * User fields for detailed views (admin panels, user profiles)
 * Includes metadata but excludes sensitive security data
 */
export const USER_DETAIL_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'avatar',
  'role',
  'status',
  'isEmailVerified',
  'isPhoneVerified',
  'createdAt',
  'lastLoginAt',
].join(' ');

/**
 * Establishment fields for list views (search results, maps)
 * Optimized for minimal payload while showing essential info
 */
export const ESTABLISHMENT_LIST_FIELDS = [
  'name',
  'address',
  'type',
  'averageRating',
  'totalReviews',
  'isVerified',
  'images',
].join(' ');

/**
 * Establishment fields for detail views
 */
export const ESTABLISHMENT_DETAIL_FIELDS = [
  'name',
  'address',
  'type',
  'description',
  'phoneNumber',
  'email',
  'website',
  'averageRating',
  'totalReviews',
  'totalOffers',
  'isVerified',
  'images',
  'openingHours',
  'acceptsReservations',
  'createdAt',
].join(' ');

/**
 * Offer fields for list views (browse, search)
 * ✅ CRITICAL: merchantId is required for .populate() to get merchant profileImage for OfferCard logo
 */
export const OFFER_LIST_FIELDS = [
  'title',
  'type',
  'images',
  'pricing',
  'totalQuantity',
  'soldQuantity',
  'reservedQuantity',
  'availableFrom',
  'availableUntil',
  'establishmentId', // Required for .populate() → establishment name, address, rating
  'merchantId', // ✅ FIX: Required for .populate() → merchant profileImage (OfferCard logo)
  'status',
  'pickupTimeSlots', // ✅ FIX: Added for OfferCard display (pickup time windows)
  'isFeaturedManual', // ✅ FIX: Added for featuring metadata
  'isFeaturedAuto', // ✅ FIX: Added for featuring metadata
  'featuredAt', // ✅ FIX: Added for featuring metadata
  'isPickupToday', // ✅ Pickup categorization
  'isPickupTomorrow', // ✅ Pickup categorization
].join(' ');

/**
 * Offer fields for detail views
 */
export const OFFER_DETAIL_FIELDS = [
  'title',
  'description',
  'type',
  'images',
  'pricing',
  'totalQuantity',
  'soldQuantity',
  'reservedQuantity',
  'categories',
  'tags',
  'dietaryInfo',
  'allergens',
  'estimatedWeight',
  'pickupTimeSlots',
  'availableFrom',
  'availableUntil',
  'establishmentId',
  'status',
  'viewCount',
].join(' ');

/**
 * Order fields for list views (order history / OrderCard)
 *
 * ✅ Must include everything the mobile OrderCard component needs:
 *    - pickupDetails.timeSlot (startTime, endTime) for pickup window display
 *    - pricing (full object) for total, currency, discountAmount
 *    - items pricing fields for strikethrough original price
 *    - establishmentId for .populate() → name, images
 */
export const ORDER_LIST_FIELDS = [
  'orderNumber',
  'customerId',
  'establishmentId',
  'status',
  'paymentStatus',
  'pricing',
  'items.offerId',
  'items.offerTitle',
  'items.quantity',
  'items.unitPrice',
  'items.totalPrice',
  'items.originalPrice',
  'items.discountAmount',
  'pickupDetails.timeSlot',
  'pickupDetails.scheduledDate',
  'expiresAt',
  'donationAmount',
  'createdAt',
].join(' ');

/**
 * Order fields for detail views
 */
export const ORDER_DETAIL_FIELDS = [
  'orderNumber',
  'customerId',
  'establishmentId',
  'merchantId',
  'items',
  'status',
  'paymentStatus',
  'paymentDetails',
  'pricing',
  'pickupDetails',
  'establishmentAddress',
  'customerNotes',
  'merchantNotes',
  'expiresAt',
  'createdAt',
  'updatedAt',
].join(' ');

/**
 * Minimal structural interface for Mongoose query builder methods.
 * Avoids deep generic coupling to Mongoose internals while preserving type safety.
 */
interface MongooseQueryLike {
  lean(): this;
  select(fields: string | string[]): this;
}

/**
 * Helper class for query optimization
 * Provides chainable methods for consistent query building
 */
export class QueryOptimizer {
  /**
   * Apply lean() to query for read-only operations
   * Returns plain JavaScript objects instead of Mongoose documents
   *
   * Performance impact:
   * - 10-15% faster query execution
   * - 50% less memory usage
   * - Cannot use Mongoose methods (save(), populate(), etc.)
   *
   * @param query - Mongoose query object
   * @returns Query with lean() applied
   */
  static applyLean<T extends MongooseQueryLike>(query: T): T {
    return query.lean();
  }

  /**
   * Apply field selection to reduce payload size
   *
   * @param query - Mongoose query object
   * @param fields - Space-separated field names or array of fields
   * @returns Query with select() applied
   */
  static applySelect<T extends MongooseQueryLike>(query: T, fields: string | string[]): T {
    return query.select(fields);
  }

  /**
   * Apply both lean() and select() for maximum optimization
   *
   * @param query - Mongoose query object
   * @param fields - Fields to select
   * @returns Optimized query
   */
  static optimize<T extends MongooseQueryLike>(query: T, fields: string | string[]): T {
    return query.select(fields).lean();
  }

  /**
   * Get pagination metadata
   *
   * @param total - Total count of documents
   * @param page - Current page number
   * @param limit - Items per page
   * @returns Pagination metadata object
   */
  static getPaginationMeta(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}

/**
 * Performance monitoring decorator for query execution time
 * Logs slow queries for optimization
 *
 * Usage:
 * ```typescript
 * @MonitorQuery('findAll')
 * async findAll() { ... }
 * ```
 */
import { Logger } from '@nestjs/common';

const queryMonitorLogger = new Logger('MonitorQuery');

export function MonitorQuery(operationName: string, thresholdMs: number = 1000) {
  return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;

        if (duration > thresholdMs) {
          queryMonitorLogger.warn(
            `[SLOW QUERY] ${operationName} took ${duration}ms (threshold: ${thresholdMs}ms)`,
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        queryMonitorLogger.error(
          `[QUERY ERROR] ${operationName} failed after ${duration}ms`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error;
      }
    };

    return descriptor;
  };
}
