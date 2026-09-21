export type InventoryStatus = 'available' | 'low_stock' | 'out_of_stock' | 'expired' | 'reserved';

export type StockUpdateReason =
  'restock' | 'sale' | 'waste' | 'adjustment' | 'return' | 'reservation' | 'release' | 'correction';

export interface InventoryItem {
  id: string;
  offerId: string;
  establishmentId: string;
  name: string;
  description?: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  expiryDate: string;
  batchNumber?: string;
  originalPrice: number;
  discountedPrice: number;
  categories?: string[];
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryFilters {
  establishmentId?: string;
  status?: InventoryStatus;
  category?: string;
  lowStock?: boolean;
  expiringSoon?: boolean;
  expiringInDays?: number;
  page: number;
  limit: number;
  sortBy?: string;
}

export interface StockUpdatePayload {
  quantity: number;
  reason: StockUpdateReason;
  notes?: string;
  orderId?: string;
}

export interface BulkUpdatePayload {
  inventoryItemIds: string[];
  quantity: number;
  reason: StockUpdateReason;
  notes?: string;
}

export interface InventoryAlert {
  id: string;
  type: 'low_stock' | 'expiring' | 'expired' | 'out_of_stock';
  itemId: string;
  itemName: string;
  message: string;
  severity: 'warning' | 'critical';
  createdAt: string;
  acknowledged: boolean;
}

export interface InventoryAnalytics {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  expiringItems: number;
  outOfStockItems: number;
  totalValue: number;
  wastePercentage: number;
}

export interface StockHistoryEntry {
  id: string;
  previousStock: number;
  newStock: number;
  change: number;
  reason: StockUpdateReason;
  notes?: string;
  performedBy?: string;
  createdAt: string;
}
