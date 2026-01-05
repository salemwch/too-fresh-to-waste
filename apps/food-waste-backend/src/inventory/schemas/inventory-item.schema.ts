import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

@Schema({ _id: false })
export class StockMovement {
  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  previousQuantity: number;

  @Prop({ required: true })
  newQuantity: number;

  @Prop({ required: true, enum: StockUpdateReason })
  reason: StockUpdateReason;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

@Schema({ _id: false })
export class StockAlert {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  threshold: number;

  @Prop({ required: true })
  currentLevel: number;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, default: Date.now })
  createdAt: Date;

  @Prop({ default: false })
  acknowledged: boolean;

  @Prop()
  acknowledgedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acknowledgedBy?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class InventoryItem {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Offer' })
  offerId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  establishmentId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 0 })
  currentStock: number;

  @Prop({ required: true, min: 0 })
  initialStock: number;

  @Prop({ default: 0, min: 0 })
  reservedStock: number;

  @Prop({ required: true, min: 0 })
  availableStock: number;

  @Prop({ min: 1, default: 5 })
  lowStockThreshold: number;

  @Prop({ required: true, enum: InventoryStatus, default: InventoryStatus.AVAILABLE })
  status: InventoryStatus;

  @Prop({ required: true })
  expiryDate: Date;

  @Prop()
  batchNumber?: string;

  @Prop({ required: true, min: 0 })
  originalPrice: number;

  @Prop({ required: true, min: 0 })
  discountedPrice: number;

  @Prop({ min: 0, max: 100 })
  discountPercentage: number;

  @Prop([String])
  categories: string[];

  @Prop([String])
  tags: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  autoUpdateStatus: boolean;

  @Prop([StockMovement])
  stockHistory: StockMovement[];

  @Prop([StockAlert])
  alerts: StockAlert[];

  @Prop()
  lastStockCheck?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastUpdatedBy?: Types.ObjectId;

  @Prop()
  estimatedSoldBy?: Date;

  @Prop({ default: 0 })
  totalSold: number;

  @Prop({ default: 0 })
  totalRevenue: number;

  @Prop()
  location?: string;

  @Prop()
  storageConditions?: string;

  @Prop({ type: Map, of: String })
  metadata?: Map<string, string>;
}

export type InventoryItemDocument = InventoryItem & Document;
export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);

// Indexes for efficient queries
InventoryItemSchema.index({ offerId: 1 });
InventoryItemSchema.index({ establishmentId: 1 });
InventoryItemSchema.index({ status: 1 });
InventoryItemSchema.index({ expiryDate: 1 });
InventoryItemSchema.index({ establishmentId: 1, status: 1 });
InventoryItemSchema.index({ currentStock: 1, lowStockThreshold: 1 });
InventoryItemSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate available stock and update status
InventoryItemSchema.pre('save', function(this: InventoryItemDocument) {
  // Calculate available stock
  this.availableStock = Math.max(0, this.currentStock - this.reservedStock);

  // Auto-update status if enabled
  if (this.autoUpdateStatus) {
    if (this.expiryDate && this.expiryDate < new Date()) {
      this.status = InventoryStatus.EXPIRED;
    } else if (this.currentStock === 0) {
      this.status = InventoryStatus.OUT_OF_STOCK;
    } else if (this.currentStock <= this.lowStockThreshold) {
      this.status = InventoryStatus.LOW_STOCK;
    } else if (this.availableStock > 0) {
      this.status = InventoryStatus.AVAILABLE;
    }
  }

  // Calculate discount percentage
  if (this.originalPrice > 0) {
    this.discountPercentage = Math.round(((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100);
  }
});