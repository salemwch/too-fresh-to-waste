/**
 * Schema Configuration Utilities
 *
 * Standardized Mongoose schema configuration for consistent API responses
 *
 * ✅ BEST PRACTICE: Use _id only (MongoDB convention)
 * - MongoDB uses _id as the primary key natively
 * - Consistent with aggregation pipelines and raw queries
 * - No transformation overhead
 * - Industry standard across MongoDB ecosystem
 */

import type { SchemaOptions, Schema } from 'mongoose';

/**
 * Standard toJSON configuration for all schemas
 *
 * Features:
 * - Includes custom virtuals (availableQuantity, isExpired, etc.)
 * - Removes __v (version key) from responses
 * - Removes Mongoose's default 'id' virtual (use _id only)
 *
 * @example
 * ```typescript
 * const MySchema = SchemaFactory.createForClass(MyClass);
 * MySchema.set('toJSON', getStandardToJSON());
 * MySchema.set('toObject', getStandardToObject());
 * ```
 */
export function getStandardToJSON(): NonNullable<SchemaOptions['toJSON']> {
  return {
    virtuals: true, // ✅ CRITICAL: Include custom virtuals (availableQuantity, isExpired, isSoldOut, etc.)
    versionKey: false, // Remove __v field
    transform(_doc, ret) {
      // ✅ Delete _id and keep 'id' virtual for API consistency
      // This codebase convention: use 'id' (not '_id') in API responses
      delete (ret as { _id?: unknown })._id;
      return ret;
    },
  };
}

/**
 * Standard toObject configuration for all schemas
 */
export function getStandardToObject(): NonNullable<SchemaOptions['toObject']> {
  return {
    virtuals: true, // ✅ CRITICAL: Include custom virtuals
    versionKey: false, // Remove __v field
    transform(_doc, ret) {
      // ✅ Delete _id and keep 'id' virtual for API consistency
      delete (ret as { _id?: unknown })._id;
      return ret;
    },
  };
}

/**
 * Apply standard configuration to a schema
 *
 * @example
 * ```typescript
 * const MySchema = SchemaFactory.createForClass(MyClass);
 * applyStandardSchemaConfig(MySchema);
 * ```
 */
export function applyStandardSchemaConfig(schema: Schema): void {
  // Cast required: Schema.set() generic bounds differ from SchemaOptions standalone types
  (schema as { set(key: string, value: unknown): void }).set('toJSON', getStandardToJSON());
  (schema as { set(key: string, value: unknown): void }).set('toObject', getStandardToObject());
}
