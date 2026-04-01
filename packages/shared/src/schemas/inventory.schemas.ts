/**
 * Inventory Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (inventory.dto.ts).
 *
 * @module shared/schemas/inventory
 */
import { z } from 'zod';
import { InventoryStatus, StockUpdateReason } from '../enums';

// ============================================================================
// Create Inventory Item
// ============================================================================

export const CreateInventoryItemSchema = z.object({
  offerId: z.string().min(1),
  establishmentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  initialStock: z.number().min(0),
  lowStockThreshold: z.number().min(1).optional(),
  expiryDate: z.string().datetime(),
  batchNumber: z.string().optional(),
  originalPrice: z.number().min(0),
  discountedPrice: z.number().min(0),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  storageConditions: z.string().optional(),
  autoUpdateStatus: z.boolean().optional(),
});

export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;

// ============================================================================
// Update Inventory Item
// ============================================================================

export const UpdateInventoryItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  currentStock: z.number().min(0).optional(),
  lowStockThreshold: z.number().min(1).optional(),
  status: z.nativeEnum(InventoryStatus).optional(),
  expiryDate: z.string().datetime().optional(),
  batchNumber: z.string().optional(),
  originalPrice: z.number().min(0).optional(),
  discountedPrice: z.number().min(0).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  autoUpdateStatus: z.boolean().optional(),
  location: z.string().optional(),
  storageConditions: z.string().optional(),
});

export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;

// ============================================================================
// Stock Update
// ============================================================================

export const StockUpdateSchema = z.object({
  quantity: z.number(),
  reason: z.nativeEnum(StockUpdateReason),
  notes: z.string().optional(),
  orderId: z.string().optional(),
});

export type StockUpdateInput = z.infer<typeof StockUpdateSchema>;

// ============================================================================
// Reserve Stock
// ============================================================================

export const ReserveStockSchema = z.object({
  quantity: z.number().min(1),
  orderId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export type ReserveStockInput = z.infer<typeof ReserveStockSchema>;

// ============================================================================
// Release Stock
// ============================================================================

export const ReleaseStockSchema = z.object({
  quantity: z.number().min(1),
  reason: z.nativeEnum(StockUpdateReason),
  notes: z.string().optional(),
});

export type ReleaseStockInput = z.infer<typeof ReleaseStockSchema>;

// ============================================================================
// Bulk Update Stock
// ============================================================================

export const BulkUpdateStockSchema = z.object({
  inventoryItemIds: z.array(z.string()).min(1),
  quantity: z.number(),
  reason: z.nativeEnum(StockUpdateReason),
  notes: z.string().optional(),
});

export type BulkUpdateStockInput = z.infer<typeof BulkUpdateStockSchema>;

// ============================================================================
// Inventory Filters
// ============================================================================

export const InventoryFiltersSchema = z.object({
  establishmentId: z.string().optional(),
  status: z.nativeEnum(InventoryStatus).optional(),
  category: z.string().optional(),
  lowStock: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => val === true || val === 'true')
    .optional(),
  expiringSoon: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => val === true || val === 'true')
    .optional(),
  expiringInDays: z.coerce.number().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional().default('-createdAt'),
});

export type InventoryFiltersInput = z.infer<typeof InventoryFiltersSchema>;

// ============================================================================
// Acknowledge Alert
// ============================================================================

export const AcknowledgeAlertSchema = z.object({
  alertId: z.string().min(1),
  notes: z.string().optional(),
});

export type AcknowledgeAlertInput = z.infer<typeof AcknowledgeAlertSchema>;
