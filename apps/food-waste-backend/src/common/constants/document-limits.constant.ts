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
