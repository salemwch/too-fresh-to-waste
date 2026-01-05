/**
 * Enterprise-grade TypeScript type utilities for Mongoose
 * Provides type-safe handling of Mongoose documents and lean queries
 */

import { Document, FlattenMaps } from 'mongoose';

/**
 * Extracts the plain object type from a Mongoose Document
 * Use this when returning results from .lean() queries
 *
 * @example
 * ```typescript
 * // Instead of:
 * const users = await UserModel.find().lean().exec() as UserDocument[];
 *
 * // Use:
 * const users: LeanDocument<UserDocument>[] = await UserModel.find().lean().exec();
 * ```
 */
export type LeanDocument<T extends Document> = FlattenMaps<T> & Required<{ _id: unknown }>;

/**
 * Array of lean documents
 * Convenience type for returning arrays of lean documents
 */
export type LeanDocumentArray<T extends Document> = LeanDocument<T>[];

/**
 * Paginated response type for lean documents
 * Use this for pagination responses with lean queries
 */
export interface PaginatedLeanResponse<T extends Document> {
  data: LeanDocument<T>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
