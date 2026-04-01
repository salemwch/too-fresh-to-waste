/**
 * Generated API Types — auto-generated from backend's OpenAPI spec
 *
 * Run `pnpm generate` in packages/shared to regenerate.
 *
 * Usage:
 *   // Access a specific DTO schema:
 *   import type { ApiSchemas } from '@foodwaste/shared';
 *   type LoginDto = ApiSchemas['LoginDto'];
 *
 *   // Access path definitions or operations:
 *   import type { paths, operations } from '@foodwaste/shared';
 */

import type { components } from './api.generated';

export type { paths, components, operations } from './api.generated';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All DTO/schema types from the OpenAPI spec.
 *
 * Provides convenient access to generated schemas without drilling
 * into `components['schemas']`.
 *
 * @example
 * ```typescript
 * import type { ApiSchemas } from '@foodwaste/shared';
 *
 * type LoginDto = ApiSchemas['LoginDto'];
 * type Offer = ApiSchemas['CreateOfferDto'];
 * ```
 */
export type ApiSchemas = components['schemas'];
