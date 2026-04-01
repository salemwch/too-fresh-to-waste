/**
 * Inventory enums — single source of truth
 * Source: apps/food-waste-backend/src/inventory/schemas/inventory-item.schema.ts
 */

export enum InventoryStatus {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired',
  RESERVED = 'reserved',
}

export enum StockUpdateReason {
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  ORDER_PLACED = 'order_placed',
  ORDER_CANCELLED = 'order_cancelled',
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  SOLD_OUT = 'sold_out',
  RESTOCKED = 'restocked',
}
