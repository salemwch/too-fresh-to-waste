/**
 * User Document Embedded Array Size Caps
 *
 * Prevents unbounded array growth toward MongoDB's 16 MB document limit.
 * Every `$push` or `.unshift()` site MUST use the corresponding constant.
 *
 * Prefer the atomic form — `$push` with `$slice` in a single `updateOne` — over
 * read, mutate, save. The latter loses entries when two requests interleave, and
 * for `loginHistory` that is a real scenario (a user signing in on two devices).
 *
 * Ref: https://www.mongodb.com/docs/manual/reference/limits/#bson-document-size
 *
 * This file was formerly `database-indexes.constant.ts` and also held an
 * `ALL_INDEXES` list used to create production indexes. That list was a second
 * source of truth beside the Mongoose schemas and had drifted badly — it covered
 * 13 of 58 collections and indexed four fields that no longer existed. Indexes
 * are now declared solely on the schemas and created by
 * `scripts/create-indexes.ts`; see `scripts/lib/schema-registry.ts`.
 */

export const USER_AUDIT_LOG_MAX = 20;
export const USER_LOGIN_HISTORY_MAX = 20;
export const USER_LOCATION_HISTORY_MAX = 20;
export const USER_CONSENT_RECORDS_MAX = 50;

/**
 * `loyaltyAccount.reviewTracking.reviewedOrderIds` — the set of orders a user
 * has already earned review points for.
 *
 * Larger than the caps above because this one is not history, it is an
 * idempotency ledger: an id that falls off the end becomes claimable again.
 * 500 reviewed orders is far beyond any real consumer's lifetime volume in this
 * market, while still bounding the array at roughly 6 KB.
 *
 * The precise shape for this is its own collection with a unique
 * `{ userId, orderId }` index, which would make re-claiming impossible at any
 * volume rather than merely implausible. That is a migration, not an edit; the
 * cap plus the `$ne` guard in `awardReviewPoints` closes the exploitable window
 * in the meantime.
 */
export const LOYALTY_REVIEWED_ORDER_IDS_MAX = 500;
