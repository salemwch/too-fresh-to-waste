import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryItem, InventoryItemDocument, InventoryStatus, StockUpdateReason, StockMovement, StockAlert } from './schemas/inventory-item.schema';
import {
  CreateInventoryItemDto,
  StockUpdateDto,
  ReserveStockDto,
  ReleaseStockDto,
  BulkUpdateStockDto,
  InventoryFiltersDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(InventoryItem.name) private inventoryModel: Model<InventoryItemDocument>,
  ) {}

  async createInventoryItem(createDto: CreateInventoryItemDto, userId?: string): Promise<InventoryItemDocument> {
    try {
      const inventoryItem = new this.inventoryModel({
        ...createDto,
        offerId: new Types.ObjectId(createDto.offerId),
        establishmentId: new Types.ObjectId(createDto.establishmentId),
        currentStock: createDto.initialStock,
        availableStock: createDto.initialStock,
        lastUpdatedBy: userId ? new Types.ObjectId(userId) : undefined,
        lastStockCheck: new Date(),
        stockHistory: [{
          quantity: createDto.initialStock,
          previousQuantity: 0,
          newQuantity: createDto.initialStock,
          reason: StockUpdateReason.RESTOCKED,
          notes: 'Initial stock',
          timestamp: new Date(),
          updatedBy: userId ? new Types.ObjectId(userId) : undefined,
        }],
      });

      const saved = await inventoryItem.save();
      this.logger.log(`Inventory item created: ${saved._id}`);
      return saved;
    } catch (error) {
      this.logger.error(`Error creating inventory item: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async getInventoryItems(filters: InventoryFiltersDto): Promise<{
    items: InventoryItemDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const query: any = {};

      if (filters.establishmentId) {
        query.establishmentId = new Types.ObjectId(filters.establishmentId);
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.category) {
        query.categories = { $in: [filters.category] };
      }

      if (filters.lowStock) {
        query.$expr = { $lte: ['$currentStock', '$lowStockThreshold'] };
      }

      if (filters.expiringSoon) {
        const daysAhead = filters.expiringInDays || 3;
        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + daysAhead);
        query.expiryDate = { $lte: expiryThreshold, $gt: new Date() };
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        this.inventoryModel
          .find(query)
          .populate('offerId', 'name description images')
          .populate('establishmentId', 'name address')
          .sort(filters.sortBy || '-createdAt')
          .skip(skip)
          .limit(limit)
          .exec(),
        this.inventoryModel.countDocuments(query),
      ]);

      return {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error fetching inventory items: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async getInventoryItem(id: string): Promise<InventoryItemDocument> {
    const item = await this.inventoryModel
      .findById(id)
      .populate('offerId')
      .populate('establishmentId')
      .exec();

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  async updateStock(id: string, updateDto: StockUpdateDto, userId?: string): Promise<InventoryItemDocument> {
    try {
      const item = await this.getInventoryItem(id);
      const previousQuantity = item.currentStock;
      const newQuantity = Math.max(0, previousQuantity + updateDto.quantity);

      const stockMovement: StockMovement = {
        quantity: updateDto.quantity,
        previousQuantity,
        newQuantity,
        reason: updateDto.reason,
        notes: updateDto.notes,
        orderId: updateDto.orderId ? new Types.ObjectId(updateDto.orderId) : undefined,
        updatedBy: userId ? new Types.ObjectId(userId) : undefined,
        timestamp: new Date(),
      };

      const updatedItem = await this.inventoryModel.findByIdAndUpdate(
        id,
        {
          $set: {
            currentStock: newQuantity,
            lastStockCheck: new Date(),
            lastUpdatedBy: userId ? new Types.ObjectId(userId) : undefined,
          },
          $push: { stockHistory: stockMovement },
        },
        { new: true }
      ).populate('offerId').populate('establishmentId');

      await this.checkAndCreateAlerts(updatedItem);

      this.logger.log(`Stock updated for item ${id}: ${previousQuantity} -> ${newQuantity}`);
      return updatedItem;
    } catch (error) {
      this.logger.error(`Error updating stock: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async reserveStock(id: string, reserveDto: ReserveStockDto, userId?: string): Promise<InventoryItemDocument> {
    try {
      const item = await this.getInventoryItem(id);

      if (item.availableStock < reserveDto.quantity) {
        throw new BadRequestException('Insufficient available stock');
      }

      const updatedItem = await this.inventoryModel.findByIdAndUpdate(
        id,
        {
          $inc: { reservedStock: reserveDto.quantity },
          $set: { lastUpdatedBy: userId ? new Types.ObjectId(userId) : undefined },
          $push: {
            stockHistory: {
              quantity: -reserveDto.quantity,
              previousQuantity: item.availableStock,
              newQuantity: item.availableStock - reserveDto.quantity,
              reason: StockUpdateReason.ORDER_PLACED,
              notes: `Reserved for order: ${reserveDto.orderId}`,
              orderId: new Types.ObjectId(reserveDto.orderId),
              updatedBy: userId ? new Types.ObjectId(userId) : undefined,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      ).populate('offerId').populate('establishmentId');

      this.logger.log(`Reserved ${reserveDto.quantity} units for order ${reserveDto.orderId}`);
      return updatedItem;
    } catch (error) {
      this.logger.error(`Error reserving stock: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async releaseStock(id: string, releaseDto: ReleaseStockDto, userId?: string): Promise<InventoryItemDocument> {
    try {
      const item = await this.getInventoryItem(id);

      if (item.reservedStock < releaseDto.quantity) {
        throw new BadRequestException('Cannot release more stock than reserved');
      }

      const updatedItem = await this.inventoryModel.findByIdAndUpdate(
        id,
        {
          $inc: { reservedStock: -releaseDto.quantity },
          $set: { lastUpdatedBy: userId ? new Types.ObjectId(userId) : undefined },
          $push: {
            stockHistory: {
              quantity: releaseDto.quantity,
              previousQuantity: item.availableStock,
              newQuantity: item.availableStock + releaseDto.quantity,
              reason: releaseDto.reason,
              notes: releaseDto.notes || 'Stock released',
              updatedBy: userId ? new Types.ObjectId(userId) : undefined,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      ).populate('offerId').populate('establishmentId');

      this.logger.log(`Released ${releaseDto.quantity} units from reservation`);
      return updatedItem;
    } catch (error) {
      this.logger.error(`Error releasing stock: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async confirmSale(id: string, quantity: number, orderId: string, userId?: string): Promise<InventoryItemDocument> {
    try {
      const item = await this.getInventoryItem(id);

      if (item.reservedStock < quantity) {
        throw new BadRequestException('Cannot confirm sale: insufficient reserved stock');
      }

      const revenue = quantity * item.discountedPrice;

      const updatedItem = await this.inventoryModel.findByIdAndUpdate(
        id,
        {
          $inc: {
            currentStock: -quantity,
            reservedStock: -quantity,
            totalSold: quantity,
            totalRevenue: revenue,
          },
          $set: { lastUpdatedBy: userId ? new Types.ObjectId(userId) : undefined },
          $push: {
            stockHistory: {
              quantity: -quantity,
              previousQuantity: item.currentStock,
              newQuantity: item.currentStock - quantity,
              reason: StockUpdateReason.SOLD_OUT,
              notes: `Sale confirmed`,
              orderId: new Types.ObjectId(orderId),
              updatedBy: userId ? new Types.ObjectId(userId) : undefined,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      ).populate('offerId').populate('establishmentId');

      await this.checkAndCreateAlerts(updatedItem);

      this.logger.log(`Sale confirmed: ${quantity} units for order ${orderId}`);
      return updatedItem;
    } catch (error) {
      this.logger.error(`Error confirming sale: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async bulkUpdateStock(bulkUpdateDto: BulkUpdateStockDto, userId?: string): Promise<InventoryItemDocument[]> {
    try {
      const results: InventoryItemDocument[] = [];

      for (const itemId of bulkUpdateDto.inventoryItemIds) {
        const updated = await this.updateStock(
          itemId,
          {
            quantity: bulkUpdateDto.quantity,
            reason: bulkUpdateDto.reason,
            notes: bulkUpdateDto.notes,
          },
          userId
        );
        results.push(updated);
      }

      this.logger.log(`Bulk update completed for ${results.length} items`);
      return results;
    } catch (error) {
      this.logger.error(`Error in bulk update: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async getInventoryAnalytics(establishmentId?: string): Promise<any> {
    try {
      const matchStage = establishmentId
        ? { $match: { establishmentId: new Types.ObjectId(establishmentId) } }
        : { $match: {} };

      const analytics = await this.inventoryModel.aggregate([
        matchStage,
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalStock: { $sum: '$currentStock' },
            totalReservedStock: { $sum: '$reservedStock' },
            totalAvailableStock: { $sum: '$availableStock' },
            totalValue: { $sum: { $multiply: ['$currentStock', '$discountedPrice'] } },
            totalRevenue: { $sum: '$totalRevenue' },
            averageDiscount: { $avg: '$discountPercentage' },
            lowStockItems: {
              $sum: {
                $cond: [{ $lte: ['$currentStock', '$lowStockThreshold'] }, 1, 0]
              }
            },
            outOfStockItems: {
              $sum: {
                $cond: [{ $eq: ['$currentStock', 0] }, 1, 0]
              }
            },
            expiredItems: {
              $sum: {
                $cond: [{ $lt: ['$expiryDate', new Date()] }, 1, 0]
              }
            },
          }
        }
      ]);

      return analytics[0] || {};
    } catch (error) {
      this.logger.error(`Error generating analytics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiringItems(): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const expiringItems = await this.inventoryModel.find({
        expiryDate: { $lte: tomorrow, $gt: new Date() },
        status: { $ne: InventoryStatus.EXPIRED },
        isActive: true,
      });

      for (const item of expiringItems) {
        await this.checkAndCreateAlerts(item, 'EXPIRING_SOON');
      }

      this.logger.log(`Checked ${expiringItems.length} expiring items`);
    } catch (error) {
      this.logger.error(`Error checking expiring items: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateExpiredItems(): Promise<void> {
    try {
      const result = await this.inventoryModel.updateMany(
        {
          expiryDate: { $lt: new Date() },
          status: { $ne: InventoryStatus.EXPIRED },
        },
        {
          $set: { status: InventoryStatus.EXPIRED },
          $push: {
            stockHistory: {
              quantity: 0,
              previousQuantity: '$currentStock',
              newQuantity: '$currentStock',
              reason: StockUpdateReason.EXPIRED,
              notes: 'Automatically marked as expired',
              timestamp: new Date(),
            },
          },
        }
      );

      this.logger.log(`Updated ${result.modifiedCount} expired items`);
    } catch (error) {
      this.logger.error(`Error updating expired items: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private async checkAndCreateAlerts(item: InventoryItemDocument, alertType?: string): Promise<void> {
    const alerts: StockAlert[] = [];

    // Low stock alert
    if (item.currentStock <= item.lowStockThreshold && item.currentStock > 0) {
      alerts.push({
        type: 'LOW_STOCK',
        threshold: item.lowStockThreshold,
        currentLevel: item.currentStock,
        message: `Low stock alert: Only ${item.currentStock} items remaining`,
        createdAt: new Date(),
        acknowledged: false,
      });
    }

    // Out of stock alert
    if (item.currentStock === 0) {
      alerts.push({
        type: 'OUT_OF_STOCK',
        threshold: 0,
        currentLevel: item.currentStock,
        message: 'Item is out of stock',
        createdAt: new Date(),
        acknowledged: false,
      });
    }

    // Expiring soon alert
    if (alertType === 'EXPIRING_SOON') {
      alerts.push({
        type: 'EXPIRING_SOON',
        threshold: 1,
        currentLevel: Math.ceil((item.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        message: `Item expiring soon: ${item.expiryDate.toLocaleDateString()}`,
        createdAt: new Date(),
        acknowledged: false,
      });
    }

    if (alerts.length > 0) {
      await this.inventoryModel.findByIdAndUpdate(item._id, {
        $push: { alerts: { $each: alerts } },
      });
    }
  }
}