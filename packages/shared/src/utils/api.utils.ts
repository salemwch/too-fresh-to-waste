/**
 * API Response Utilities
 *
 * Platform-agnostic helpers for unwrapping the backend response envelope.
 * Backend always returns: { status: 'success'|'error', message, data, meta? }
 *
 * Mobile: import from @foodwaste/shared (replaces apiClient.ts wrappers)
 * Web:    import from @foodwaste/shared (replaces manual response.data.data access)
 */

import type { ApiResponse } from '../types/api.types';

// ─── Core unwrap (throws on invalid structure) ───────────────────────────────

/**
 * Extracts `data` from the backend response envelope.
 * Throws a descriptive error if the envelope is malformed.
 *
 * @example
 * const user = unwrapBackendResponse<User>(response, 'user profile');
 */
export function unwrapBackendResponse<T>(response: { data: ApiResponse<T> }, context?: string): T {
  const ctx = context ? ` [${context}]` : '';
  const responseData = (response as { data?: unknown }).data;

  if (responseData == null || typeof responseData !== 'object') {
    throw new Error(`Invalid response${ctx}: missing data wrapper`);
  }

  const envelope = responseData as ApiResponse<T>;

  // status must be 'success' | 'error'
  if (typeof envelope.status !== 'string') {
    throw new Error(`Invalid response${ctx}: status field is not a string`);
  }

  if (!('data' in envelope)) {
    throw new Error(`Invalid response${ctx}: missing data field`);
  }

  return envelope.data;
}

// ─── Safe unwrap (returns default on error) ──────────────────────────────────

/**
 * Same as `unwrapBackendResponse` but returns `defaultValue` instead of throwing.
 * Useful for optional/nullable endpoints.
 *
 * @example
 * const settings = unwrapBackendResponseSafe(response, {}, 'user settings');
 */
export function unwrapBackendResponseSafe<T>(
  response: { data: ApiResponse<T> },
  defaultValue: T,
  context?: string,
): T {
  try {
    return unwrapBackendResponse(response, context);
  } catch {
    return defaultValue;
  }
}
