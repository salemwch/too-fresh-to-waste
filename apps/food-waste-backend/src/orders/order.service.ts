import * as crypto from 'crypto';

import { DEFAULT_CURRENCY, ORDER_GRACE_PERIOD_MS, UserRole } from '@foodwaste/shared';
import { InjectQueue } from '@nestjs/bull';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types, ClientSession, FlattenMaps, PipelineStage } from 'mongoose';

import { OrderCompletedEvent } from '../common/events';
import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { AppLoggerService } from '../common/services/logger.service';
import { haversineKm } from '../common/utils/geo.util';
import { ORDER_LIST_FIELDS, ORDER_DETAIL_FIELDS } from '../common/utils/query-optimization.util';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import { NotificationService } from '../notifications/services/notification.service';
import { Offer, OfferDocument, OfferStatus } from '../offers/schemas/offer.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/schemas/payment.schema';
import { PayoutService } from '../payments/services/payout.service';
import { RefundService } from '../payments/services/refund.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { WebSocketService } from '../websocket/websocket.service';

import {
  CreateOrderDto,
  ConfirmPickupDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderQueryDto,
} from './DTO/create-order.dto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  OrderItem,
  PaymentStatus as OrderPaymentStatus,
} from './schemas/order.schema';

/**
 * Lean result type for Order documents
 * Use this for results from .lean() queries to maintain type safety
 *
 * Note: When using .lean(), Mongoose returns POJO with FlattenMaps type.
 * We use 'unknown' for _id to accept both ObjectId and FlattenMaps variants.
 */
export type OrderLean = FlattenMaps<Order> & { _id: unknown };

// Core business interfaces for type safety
interface OrderQueryFilter {
  customerId?: Types.ObjectId;
  merchantId?: Types.ObjectId;
  establishmentId?: Types.ObjectId;
  status?: OrderStatus;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  $or?: Array<{
    orderNumber?: { $regex: string; $options: string };
    items?: { $elemMatch: { offerTitle: { $regex: string; $options: string } } };
  }>;
}

interface OrderSort {
  [field: string]: 1 | -1;
}

interface OrderStatsResult {
  _id: null;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  confirmedOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  bagsSaved: number;
}

export type ChartGranularity = 'day' | 'week' | 'month';

/** Module-level constant — shared by service methods (no heap allocation per call). */
const CHART_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface RevenueChartResponse {
  label: string;
  year: number;
  month: number;
  /** ISO week number — only set when granularity is 'week'. */
  week?: number;
  /** Day of month — only set when granularity is 'day'. */
  day?: number;
  revenue: number;
  orderCount: number;
  bagCount: number;
}

/** @deprecated Renamed to RevenueChartResponse. Kept for import compatibility. */
export type MonthlyRevenueResponse = RevenueChartResponse;

export interface CustomerLocationResponse {
  city: string;
  count: number;
}

export interface OrderStatsResponse {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  confirmedOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  /** Sum of items[].quantity for picked_up orders (actual bag count, not order count) */
  bagsSaved: number;
}

interface OrderItemProcessed {
  offerId: Types.ObjectId;
  offerTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice: number;
  discountAmount: number;
}

interface ItemValidationDetail {
  offerId?: Types.ObjectId;
  reason: string;
}

interface OrderQuantityUpdate {
  offerId: Types.ObjectId;
  quantity: number;
  slotStart: string;
  slotEnd: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  /**
   * Points awarded per bag for completed orders
   */
  private readonly POINTS_PER_BAG = 10;

  constructor(
    @InjectModel(Order.name) readonly orderModel: Model<OrderDocument>,
    @InjectModel(Offer.name) readonly offerModel: Model<OfferDocument>,
    @InjectModel(Establishment.name) readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name) readonly userModel: Model<UserDocument>,
    @InjectModel(Payment.name) readonly paymentModel: Model<PaymentDocument>,
    private readonly appLogger: AppLoggerService,
    private readonly regexSecurityUtil: RegexSecurityUtil,
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WebSocketService)) private readonly webSocketService: WebSocketService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @InjectQueue('pickup-reminders') private readonly pickupReminderQueue: Queue,
  ) {
    void this.POINTS_PER_BAG;
  }
  async create(createOrderDto: CreateOrderDto, customerId: string): Promise<OrderDocument> {
    const session = await this.orderModel.db.startSession();

    try {
      let finalOrder: OrderDocument | null = null;

      await session.withTransaction(async () => {
        // Fetch customer + establishment in parallel — independent queries.
        const [customer, establishment] = await Promise.all([
          this.userModel.findById(customerId).session(session),
          this.establishmentModel.findById(createOrderDto.establishmentId).session(session),
        ]);
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
        if (!establishment) {
          throw new NotFoundException('Establishment not found');
        }

        // Require a phone number for order placement.
        // OTP verification is optional (enabled separately via Twilio).
        if (!customer.phoneNumber) {
          throw new BadRequestException({
            message: 'Phone number required to place orders',
            code: 'PHONE_VERIFICATION_REQUIRED',
            requiresPhoneSetup: true,
            requiresPhoneVerification: false,
          });
        }
        const { orderItems, subtotal, totalDiscountAmount, updates, earliestOfferExpiry } =
          await this.validateAndBuildOrderItems(createOrderDto, session);
        // reservedQuantity and currentOrders target independent fields;
        // flatten into a single Promise.all to eliminate serial round-trips.
        // Return updated offers to check for sold-out status.
        const updatedOffers = await Promise.all([
          ...updates.map(update =>
            this.offerModel.findByIdAndUpdate(
              update.offerId,
              {
                $inc: { reservedQuantity: update.quantity },
              },
              { session, new: true },
            ),
          ),
          ...updates.map(update =>
            this.offerModel.findOneAndUpdate(
              {
                _id: update.offerId,
                'pickupTimeSlots.startTime': update.slotStart,
                'pickupTimeSlots.endTime': update.slotEnd,
              },
              { $inc: { 'pickupTimeSlots.$.currentOrders': 1 } },
              { session },
            ),
          ),
        ]);

        // Auto-transition to SOLD_OUT when all bags are reserved/sold.
        // Mongoose pre-save hooks don't fire for findByIdAndUpdate,
        // so we check manually after the quantity increment.
        await this.autoUpdateOfferSoldOutStatus(
          updatedOffers.slice(0, updates.length) as OfferDocument[],
          session,
        );

        // 5. Calculate pricing
        // 3 TND delivery fee applies only when customer chooses pay_on_delivery
        const DELIVERY_FEE = 3;
        const serviceFee = createOrderDto.paymentMethod === 'pay_on_delivery' ? DELIVERY_FEE : 0;
        const taxAmount = 0;
        const total = subtotal + serviceFee + taxAmount;

        // 5.1. Charity donation: 5% of platform's cut, based on bag price only (not delivery fee)
        // Formula: (subtotal * 0.20 platform fee) * 0.05 donation percentage = 1% of subtotal
        const donationAmount = parseFloat((subtotal * 0.01).toFixed(3));

        // --- Delivery fields (computed once, never recalculated) ---
        const isDelivery = createOrderDto.deliveryMode === 'delivery';
        let deliveryFields: {
          collectionStartTime?: Date;
          collectionEndTime?: Date;
          estimatedDistanceKm?: number;
          deliveryFee?: number;
          driverEarnings?: number;
          platformDeliveryCommission?: number;
        } = {};

        if (isDelivery) {
          // Food waste orders: food is already prepared — driver can collect
          // immediately after the consumer confirms. Use now as collection start
          // so the driver geo-query ($lte now+buffer) matches right away.
          // Collection must complete before the offer expires.
          const collectionStartTime = new Date();
          const collectionEndTime = earliestOfferExpiry;

          // Establishment coordinates — GeoJSON stores [lng, lat]; haversineKm expects { lat, lng }
          const geoCoords = establishment.address.coordinates.coordinates;
          const estCoords = { lat: geoCoords[1] ?? 0, lng: geoCoords[0] ?? 0 };
          const custCoords = createOrderDto.deliveryAddress!.coordinates;
          const distKm = haversineKm(estCoords, custCoords);

          const maxDeliveryKm = this.configService.get<number>('MAX_DELIVERY_KM') ?? 5;
          if (distKm > maxDeliveryKm) {
            throw new BadRequestException(
              `Delivery is only available within ${maxDeliveryKm} km. This establishment is ${distKm.toFixed(1)} km away.`,
            );
          }

          const fee = this.configService.get<number>('FLAT_DELIVERY_FEE') ?? 3.0;
          const driverCut = this.configService.get<number>('DRIVER_CUT_RATIO') ?? 0.8;

          deliveryFields = {
            collectionStartTime,
            collectionEndTime,
            estimatedDistanceKm: distKm,
            deliveryFee: fee,
            driverEarnings: fee * driverCut,
            platformDeliveryCommission: fee * (1 - driverCut),
          };
        }

        // 6. Generate metadata
        const orderNumber = this.generateOrderNumber();
        const qrCode = this.generateQRCode();
        const pickupCode = this.generatePickupCode();
        const pickupDate = this.buildPickupDate(
          createOrderDto.pickupDate,
          createOrderDto.pickupTimeSlot.startTime,
        );

        // 7. Create and save order
        const order = new this.orderModel({
          orderNumber,
          customerId: new Types.ObjectId(customerId),
          establishmentId: new Types.ObjectId(createOrderDto.establishmentId),
          merchantId: establishment.ownerId,
          items: orderItems,
          // Delivery orders skip merchant confirmation — the merchant committed
          // to the time window when publishing the offer, and food waste is
          // already prepared. Auto-confirm so drivers see it immediately.
          status: isDelivery ? OrderStatus.CONFIRMED : OrderStatus.RESERVED,
          paymentStatus: PaymentStatus.PENDING,
          pickupDetails: {
            timeSlot: createOrderDto.pickupTimeSlot,
            scheduledDate: pickupDate,
            qrCode,
            pickupCode,
            instructions: createOrderDto.pickupInstructions,
          },
          paymentDetails: {
            method: createOrderDto.paymentMethod,
            amount: total,
            currency: DEFAULT_CURRENCY,
          },
          pricing: {
            subtotal,
            discountAmount: totalDiscountAmount,
            taxAmount,
            serviceFee,
            total,
            currency: DEFAULT_CURRENCY,
          },
          establishmentAddress: establishment.address,
          customerNotes: createOrderDto.customerNotes,
          donationAmount, // Add donation tracking
          // Order expires when offer expires + 30min grace period
          expiresAt: new Date(earliestOfferExpiry.getTime() + ORDER_GRACE_PERIOD_MS),
          // Delivery fields — set at creation, never mutated
          deliveryMode: createOrderDto.deliveryMode ?? 'pickup',
          ...(createOrderDto.deliveryAddress && {
            deliveryAddress: createOrderDto.deliveryAddress,
          }),
          driverCancellationCount: 0,
          ...deliveryFields,
        });

        const savedOrder = await order.save({ session });

        // 8. Hydrate populated refs from already-fetched documents.
        //    customer, establishment were loaded at the top of the
        //    transaction — reuse them instead of a second findById +
        //    3 populate round-trip.
        const orderPlain = savedOrder.toObject() as unknown as Record<string, unknown>;
        orderPlain['customerId'] = {
          _id: customer._id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phoneNumber: customer.phoneNumber,
        };
        orderPlain['establishmentId'] = {
          _id: establishment._id,
          name: establishment.name,
          address: establishment.address,
          phoneNumber: establishment.phoneNumber,
          type: establishment.type,
        };
        finalOrder = orderPlain as unknown as OrderDocument;
      });

      // Donation creation is now handled via order.completed event

      // Notify merchant via WebSocket + push (non-blocking — failure must not break order creation)
      if (finalOrder === null) {
        throw new InternalServerErrorException('Order was not created');
      }

      const createdOrder: OrderDocument = finalOrder;
      this.notifyMerchantNewOrder(createdOrder).catch((err: Error) => {
        this.appLogger.error(
          `Merchant notification failed for order ${createdOrder.orderNumber}: ${err.message}`,
          'OrderService.notifyMerchant',
        );
      });

      this.schedulePickupReminder(createdOrder).catch((err: Error) => {
        this.appLogger.error(
          `Failed to schedule pickup reminder for order ${createdOrder.orderNumber}: ${err.message}`,
          'OrderService.schedulePickupReminder',
        );
      });

      return createdOrder;
    } catch (error) {
      this.appLogger.error(`Order creation failed: ${(error as Error).message}`, 'OrderService');

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create order');
    } finally {
      await session.endSession();
    }
  }

  private isValidStatusTransition(oldStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.RESERVED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.READY_FOR_PICKUP]: [
        OrderStatus.PICKED_UP,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.PICKED_UP]: [OrderStatus.REFUNDED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.EXPIRED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    return allowedTransitions[oldStatus]?.includes(newStatus) || false;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  private generateQRCode(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  private generatePickupCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Sends WebSocket event + push notification to the merchant when a new order
   * is placed.  pickupCode is included — merchants need it on their dashboard.
   * Wrapped in try/catch so a failure here never propagates to the caller.
   */
  private async notifyMerchantNewOrder(order: OrderDocument): Promise<void> {
    const merchantId =
      order.merchantId._id !== null && order.merchantId._id !== undefined
        ? order.merchantId._id.toString()
        : order.merchantId.toString();

    const customer = order.customerId as unknown as { firstName?: string; lastName?: string };
    const customerName =
      customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : 'Customer';

    this.appLogger.log(
      `[notifyMerchantNewOrder] order="${order.orderNumber}" merchantId="${merchantId}" customer="${customerName}"`,
      'OrderService',
    );

    const payload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items.map(item => ({
        title: item.offerTitle,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      pickupDetails: {
        timeSlot: order.pickupDetails.timeSlot,
        scheduledDate: order.pickupDetails.scheduledDate,
        pickupCode: order.pickupDetails.pickupCode,
      },
      customerName,
      pricing: { total: order.pricing.total },
    };

    // Build the full set of user IDs that should receive this notification.
    // Always includes the offer creator (merchantId on the order).
    // Also includes the assigned location manager for this establishment (if any)
    // and the establishment's merchant owner (if different from the creator).
    const recipientIds = new Set<string>([merchantId]);

    if (order.establishmentId) {
      // order.establishmentId may be a hydrated object after creation (lines 388-394).
      const estRaw: unknown = order.establishmentId;
      const estId =
        estRaw && typeof estRaw === 'object' && '_id' in estRaw
          ? String((estRaw as { _id: unknown })._id)
          : String(order.establishmentId);

      // Find any LM assigned to this establishment
      const lm = await this.userModel
        .findOne(
          { assignedEstablishmentId: new Types.ObjectId(estId), role: UserRole.LOCATION_MANAGER },
          { _id: 1 },
        )
        .lean()
        .exec();
      if (lm) {
        recipientIds.add((lm._id as Types.ObjectId).toString());
      }

      // Find the establishment's merchant owner to cover LM-created offers
      const est = await this.establishmentModel.findById(estId, { ownerId: 1 }).lean().exec();
      if (est?.ownerId) {
        recipientIds.add(est.ownerId.toString());
      }
    }

    // 1. WebSocket — real-time dashboard update for all recipients
    for (const uid of recipientIds) {
      this.appLogger.log(
        `[notifyMerchantNewOrder] sendToUser(userId="${uid}", event="order:new")`,
        'OrderService',
      );
      this.webSocketService.sendToUser(uid, 'order:new', payload);
    }

    // 2. Push notification — visible even when app is in background
    await this.notificationService.sendNotification({
      type: 'push',
      trigger: 'order_confirmed',
      target: { userId: merchantId },
      payload: {
        title: `New Order #${order.orderNumber}`,
        body: `Pickup code: ${order.pickupDetails.pickupCode}`,
        data: {
          orderId: order._id.toString(),
          pickupCode: order.pickupDetails.pickupCode,
        },
      },
      priority: 'high',
    });
  }

  private async schedulePickupReminder(order: OrderDocument): Promise<void> {
    if (!order.expiresAt) {
      return;
    }

    const twoHoursMs = 2 * 60 * 60 * 1000;
    // Fire 2h before offer expiry (expiresAt already includes the 30min grace, so subtract it back)
    const reminderAt = new Date(order.expiresAt.getTime() - ORDER_GRACE_PERIOD_MS - twoHoursMs);
    const delay = reminderAt.getTime() - Date.now();

    if (delay <= 0) {
      this.appLogger.log(
        `Skipping pickup reminder for order ${order.orderNumber} — window already passed`,
        'OrderService',
      );
      return;
    }

    const customerId =
      (order.customerId as unknown as { _id?: unknown })?._id?.toString() ??
      order.customerId.toString();
    const establishment = order.establishmentId as unknown as { name?: string };
    const firstItem = order.items[0];

    await this.pickupReminderQueue.add(
      'send-2h-reminder',
      {
        orderId: order._id.toString(),
        customerId,
        establishmentName: establishment.name ?? 'the establishment',
        offerTitle: firstItem?.offerTitle ?? 'your order',
        availableUntil: new Date(order.expiresAt.getTime() - ORDER_GRACE_PERIOD_MS).toISOString(),
      },
      { delay, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    );

    this.appLogger.log(
      `Pickup reminder scheduled for order ${order.orderNumber} in ${Math.round(delay / 60000)} min`,
      'OrderService',
    );
  }

  async findById(orderId: string, userId?: string, userRole?: UserRole): Promise<OrderDocument> {
    // ✅ PERFORMANCE: Single aggregation replaces findById + 4 populates (5 → 1 round-trip)
    const detailFields = ORDER_DETAIL_FIELDS.split(' ');
    const projectStage: Record<string, 1> = {};
    for (const field of detailFields) {
      projectStage[field] = 1;
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(orderId) } },
      { $project: projectStage },
      ...this.buildCustomerLookup(),
      ...this.buildEstablishmentLookupForOrder(),
      ...this.buildMerchantLookupForOrder(),
      ...this.buildItemsOfferLookup(true),
    ];

    const results = await this.orderModel.aggregate(pipeline).exec();
    const order = results[0] as OrderDocument | undefined;

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access permissions
    if (userId && userRole !== UserRole.ADMIN) {
      const isCustomer = order.customerId._id.toString() === userId;
      const isMerchant = order.merchantId._id.toString() === userId;

      if (!isCustomer && !isMerchant) {
        throw new ForbiddenException('Access denied');
      }
    }

    return order;
  }

  async findAll(
    page: number,
    limit: number,
    filters: OrderQueryDto,
    userId?: string,
    userRole?: UserRole,
  ): Promise<{ orders: OrderLean[]; total: number }> {
    // ✅ OPTIMIZATION: Limit max page size to prevent DOS
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    const { query, sort } = this.buildQuery(userRole, userId, filters);

    // ✅ PERFORMANCE: Single aggregation replaces find + 3 populates (4 → 1 round-trip)
    // Note: findAll does NOT populate merchantId — preserving this behavior
    const listFields = ORDER_LIST_FIELDS.split(' ');
    const projectStage: Record<string, 1> = {};
    for (const field of listFields) {
      projectStage[field] = 1;
    }

    const pipeline: PipelineStage[] = [
      { $match: query },
      { $project: projectStage },
      ...this.buildCustomerLookup(),
      ...this.buildEstablishmentLookupForOrder(),
      ...this.buildItemsOfferLookup(false),
      { $sort: sort },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const [orders, total] = await Promise.all([
      this.orderModel.aggregate(pipeline).exec(),
      this.orderModel.countDocuments(query),
    ]);

    return { orders: orders as OrderLean[], total };
  }

  private buildQuery(
    userRole?: UserRole,
    userId?: string,
    filters?: OrderQueryDto,
  ): { query: OrderQueryFilter; sort: OrderSort } {
    const safeFilters = filters ?? {};
    const query: OrderQueryFilter = {};

    // Role-based filtering
    if (userRole === UserRole.CONSUMER) {
      if (!userId) {
        throw new Error('User ID is required for consumer');
      }
      query.customerId = new Types.ObjectId(userId);
    } else if (userRole === UserRole.MERCHANT) {
      if (!userId) {
        throw new Error('User ID is required for merchant');
      }
      query.merchantId = new Types.ObjectId(userId);
    } else if (userRole === UserRole.LOCATION_MANAGER) {
      // Location managers see orders by establishmentId, not merchantId
    } else if (userRole !== null && userRole !== undefined && userRole !== UserRole.ADMIN) {
      throw new Error(`Invalid user role: ${userRole}`);
    }

    // Filters
    if (safeFilters.status !== null && safeFilters.status !== undefined) {
      query.status = safeFilters.status as OrderStatus;
    }
    if (safeFilters.establishmentId) {
      query.establishmentId = new Types.ObjectId(safeFilters.establishmentId);
    }

    if (safeFilters.fromDate || safeFilters.toDate) {
      query.createdAt = {};
      if (safeFilters.fromDate) {
        query.createdAt.$gte = new Date(safeFilters.fromDate);
      }
      if (safeFilters.toDate) {
        query.createdAt.$lte = new Date(safeFilters.toDate);
      }
    }

    if (safeFilters.search) {
      // Security: Escape regex pattern to prevent ReDoS attacks
      const safeRegex = this.regexSecurityUtil.buildSafeRegexQuery(safeFilters.search);

      if (safeRegex) {
        query.$or = [
          { orderNumber: safeRegex },
          { items: { $elemMatch: { offerTitle: safeRegex } } },
        ];
      } else {
        // If pattern is invalid, log and skip search (fail-safe)
        this.appLogger.warn(
          `Invalid search pattern blocked: ${safeFilters.search}`,
          'OrderService',
        );
      }
    }

    // Sorting
    const sortField = safeFilters.sortBy ?? 'createdAt';
    const sortOrder = safeFilters.sortOrder === 'asc' ? 1 : -1;

    const sort: OrderSort = { [sortField]: sortOrder };
    return { query, sort };
  }

  async requestPickupExtension(
    orderId: string,
    newPickupDate: string,
    userId: string,
    userRole: UserRole,
  ) {
    // 1. Validate via findById (aggregation — POJO is fine for reads/permission checks)
    const order = await this.findById(orderId, userId, userRole);

    if (order.status !== 'confirmed' && order.status !== 'ready_for_pickup') {
      throw new BadRequestException('Cannot extend pickup time for this order status');
    }

    const parsedDate = new Date(newPickupDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException(
        'Invalid pickup date format. Use ISO string like 2025-08-26T21:00:00.000Z',
      );
    }
    this.appLogger.log(
      `Incoming newPickupDate: ${newPickupDate} (type: ${typeof newPickupDate})`,
      'OrderService',
    );

    // 2. Atomic update instead of .save() (aggregation returns POJO, not Mongoose doc)
    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: {
        pickupExtensionRequest: {
          newDate: parsedDate,
          approved: null,
          requestedAt: new Date(),
        },
      },
    });

    this.appLogger.log(
      `Setting pickup extension - newPickupDate: ${newPickupDate} (type: ${typeof newPickupDate})`,
      'OrderService',
    );

    // 3. Return populated result
    return this.findById(orderId);
  }

  async findByCustomer(
    customerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ orders: OrderLean[]; total: number }> {
    const result = await this.findAll(page, limit, {}, customerId, UserRole.CONSUMER);
    return result;
  }

  async findByMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 10,
    establishmentId?: string,
    userRole: UserRole = UserRole.MERCHANT,
  ): Promise<{ orders: OrderLean[]; total: number }> {
    const filters: OrderQueryDto = {};
    if (establishmentId !== null && establishmentId !== undefined) {
      filters.establishmentId = establishmentId;
    }
    const result = await this.findAll(page, limit, filters, merchantId, userRole);
    return result;
  }

  async updateStatus(
    orderId: string,
    updateDto: UpdateOrderStatusDto,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId, userId, userRole);
    if (!this.isValidStatusTransition(order.status, updateDto.status as OrderStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${updateDto.status}`,
      );
    }

    // Role-based permissions
    if (userRole === UserRole.MERCHANT) {
      if (order.merchantId._id.toString() !== userId) {
        throw new ForbiddenException('Access denied');
      }
      // Merchants can only confirm, mark ready, or cancel
      const allowedStatuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.CANCELLED,
      ];
      if (!allowedStatuses.includes(updateDto.status as OrderStatus)) {
        throw new ForbiddenException('Invalid status update for merchant');
      }
    }

    const updatedOrder = await this.orderModel.findByIdAndUpdate(
      orderId,
      {
        status: updateDto.status,
        merchantNotes: updateDto.notes,
        ...(updateDto.reason && { cancellationReason: updateDto.reason }),
      },
      { new: true },
    );

    if (!updatedOrder) {
      throw new NotFoundException('Order not found');
    }

    return this.findById(updatedOrder._id.toString());
  }

  /**
   * Maximum failed pickup attempts before lockout
   */
  private readonly MAX_FAILED_PICKUP_ATTEMPTS = 5;

  /**
   * Confirms pickup of an order
   *
   * TGTG Model Flow:
   * 1. Validates pickup code/QR
   * 2. Only merchant can confirm pickup
   * 3. Updates order status to PICKED_UP
   * 4. Updates payment status from HELD to EARNED
   * 5. Creates MerchantPayoutLedger entry (75% merchant / 25% platform)
   * 6. Updates inventory (reservedQuantity -> soldQuantity)
   *
   * Security:
   * - Rate limited at controller level (5 req/min)
   * - Failed attempts tracked and order locked after 5 failures
   * - Only merchant can confirm pickup
   *
   * Uses MongoDB transaction for atomicity
   */
  async confirmPickup(
    orderId: string,
    confirmDto: ConfirmPickupDto,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    this.appLogger.log(
      `Order pickup details: ${JSON.stringify(order.pickupDetails)}`,
      'OrderService',
    );

    // Security: Check if order is locked due to too many failed attempts
    if (order.pickupLocked) {
      this.appLogger.warn(
        `Pickup attempt on locked order ${orderId} by user ${userId}`,
        'OrderService.PickupSecurity',
      );
      throw new ForbiddenException({
        message: 'Order pickup is locked due to too many failed attempts',
        code: 'PICKUP_LOCKED',
        lockedAt: order.pickupLockedAt,
        reason: order.pickupLockedReason,
        contactSupport: true,
      });
    }

    // Check if order is ready for pickup (RESERVED, READY_FOR_PICKUP, or CONFIRMED for backward compat)
    const validStatuses = [
      OrderStatus.RESERVED,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.CONFIRMED,
    ];
    if (!validStatuses.includes(order.status)) {
      throw new BadRequestException({
        message: 'Order is not ready for pickup yet. Please wait for the merchant to confirm it.',
        code: 'ORDER_NOT_READY',
      });
    }

    // Pickup-code expiry: aligned with order expiration (offer.availableUntil + 30min)
    // If order has expiresAt, code expires when order expires.
    // Fallback: pickup end time + 30min (matches pre-save fallback).
    if (confirmDto.pickupCode) {
      let codeExpiresAt: Date;

      if (order.expiresAt) {
        codeExpiresAt = new Date(order.expiresAt);
      } else {
        const pickupEnd = new Date(order.pickupDetails.scheduledDate);
        const [h, m] = order.pickupDetails.timeSlot.endTime.split(':').map(Number);
        pickupEnd.setHours(h ?? 0, m ?? 0, 0, 0);
        codeExpiresAt = new Date(pickupEnd.getTime() + ORDER_GRACE_PERIOD_MS);
      }

      if (new Date() > codeExpiresAt) {
        throw new BadRequestException({
          message: 'Pickup code has expired. The order window has ended.',
          code: 'CODE_EXPIRED',
        });
      }
    }

    // --- Change E: Role-based enforcement on the pickup-code path ---
    // ConfirmPickupDto.pickupCode is @IsNotEmpty — it is always present on
    // every request.  The semantic split is:
    //   Consumer path  → pickupCode is the real credential (qrCode absent)
    //   Merchant path  → qrCode is the real credential (pickupCode is forced
    //                     by the DTO but is not used for merchant auth)
    if (userRole === UserRole.CONSUMER) {
      // Only the consumer who owns this order may confirm via pickup code
      if (order.customerId._id.toString() !== userId) {
        throw new ForbiddenException('Only the order owner can confirm pickup');
      }
    }
    if (userRole === UserRole.MERCHANT) {
      // Merchants MUST provide a qrCode — they cannot rely on pickupCode alone
      if (!confirmDto.qrCode) {
        throw new ForbiddenException('Merchants must confirm pickup using a QR code');
      }
      // And it must belong to this merchant's order
      if (order.merchantId._id.toString() !== userId) {
        throw new ForbiddenException('Only the establishment merchant can confirm pickup');
      }
    }

    // Validate pickup code or QR code
    const isValidCode =
      order.pickupDetails.pickupCode === confirmDto.pickupCode ||
      (confirmDto.qrCode !== undefined && order.pickupDetails.qrCode === confirmDto.qrCode);
    this.appLogger.log(
      `Validating pickup - Order details: ${JSON.stringify(order.pickupDetails)}`,
      'OrderService',
    );

    if (!isValidCode) {
      await this.trackFailedPickupAttempt(orderId, userId);
      throw new BadRequestException('Invalid pickup code or QR code');
    }

    // Use transaction for atomicity
    const session = await this.orderModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Atomic gate — only one concurrent request can flip the status.
        //    The filter includes the current valid statuses; if a second
        //    request races in after the first already set PICKED_UP, the
        //    filter will not match and claimed will be null.
        // Build the code-match clause.  Pre-validation (isValidCode above)
        // already confirmed at least one code is correct.  The $or here
        // mirrors that OR so the atomic filter does not reject a valid
        // request simply because the other code field doesn't match.
        const codeMatch: Record<string, unknown>[] = [];
        if (confirmDto.pickupCode) {
          codeMatch.push({ 'pickupDetails.pickupCode': confirmDto.pickupCode });
        }
        if (confirmDto.qrCode) {
          codeMatch.push({ 'pickupDetails.qrCode': confirmDto.qrCode });
        }

        // Check if payment method is cash-based (needs paymentStatus update on pickup)
        const isCashPayment = ['cash_on_pickup', 'pay_on_delivery'].includes(
          order.paymentDetails?.method ?? '',
        );

        const claimed = await this.orderModel.findOneAndUpdate(
          {
            _id: orderId,
            status: {
              $in: [OrderStatus.RESERVED, OrderStatus.READY_FOR_PICKUP, OrderStatus.CONFIRMED],
            },
            $or: codeMatch,
          },
          {
            $set: {
              status: OrderStatus.PICKED_UP,
              'pickupDetails.actualPickupTime': new Date(),
              // For cash/delivery payments, mark as paid when confirmed
              ...(isCashPayment && { paymentStatus: OrderPaymentStatus.PAID }),
              ...(confirmDto.notes && { customerNotes: confirmDto.notes }),
            },
          },
          { session, new: true },
        );

        if (!claimed) {
          throw new BadRequestException({
            message: 'Order already confirmed or invalid',
            code: 'PICKUP_ALREADY_DONE',
          });
        }

        // 2. Update inventory (release reserved, add to sold)
        await Promise.all(
          order.items.map(item =>
            this.offerModel.findByIdAndUpdate(
              item.offerId,
              {
                $inc: {
                  reservedQuantity: -item.quantity,
                  soldQuantity: item.quantity,
                },
              },
              { session },
            ),
          ),
        );

        // 3. Find the payment and update status to EARNED
        const payment = await this.paymentModel
          .findOne({
            orderId: new Types.ObjectId(orderId),
          })
          .session(session);

        if (payment?.status === PaymentStatus.HELD) {
          payment.status = PaymentStatus.EARNED;
          payment.earnedAt = new Date();
          await payment.save({ session });

          // 4. Create MerchantPayoutLedger entry for monthly payout
          // Check if ledger entry already exists (idempotency)
          const existingLedger = await this.payoutService.findByOrderId(orderId);
          if (!existingLedger) {
            await this.payoutService.createLedgerEntry(
              {
                merchantId: order.merchantId._id,
                orderId: order._id,
                paymentId: payment._id,
                establishmentId: order.establishmentId._id,
                orderTotal: order.pricing.total,
              },
              session,
            );
          }

          this.appLogger.log(
            `Pickup confirmed for order ${orderId}: Payment status HELD -> EARNED, ledger created`,
            'OrderService',
          );
        } else if (payment) {
          // Legacy flow: payment already COMPLETED
          this.appLogger.log(
            `Pickup confirmed for order ${orderId}: Payment status ${payment.status} (legacy)`,
            'OrderService',
          );
        } else {
          // Cash payment flow: no Payment doc exists
          const method = order.paymentDetails?.method;
          if (method && ['cash_on_pickup', 'pay_on_delivery'].includes(method)) {
            this.appLogger.log(
              `Pickup confirmed for order ${orderId}: Cash payment (${method}) - order paymentStatus PENDING -> PAID`,
              'OrderService',
            );
          }
        }
      });

      // 5. Emit order completed event for cross-module reactions (loyalty, donations, analytics)
      const totalBags = order.items.reduce((sum, item) => sum + item.quantity, 0);

      try {
        await this.eventBus.emit(
          'order.completed',
          new OrderCompletedEvent(
            orderId,
            order.customerId._id.toString(),
            order.merchantId._id.toString(),
            order.items[0]?.offerId.toString() ?? '',
            order.pricing?.total || 0,
            new Date(),
            {
              itemCount: totalBags,
              isFirstOrder: false,
            },
            order.pricing?.subtotal || 0,
          ),
        );
        this.appLogger.log(
          `Order completed event emitted for order ${orderId}`,
          'OrderService.Events',
        );
      } catch (eventError) {
        // Log error but don't fail the pickup confirmation
        this.appLogger.error(
          `Failed to emit order completed event for order ${orderId}: ${(eventError as Error).message}`,
          'OrderService.Events',
        );
      }

      return this.findById(orderId);
    } catch (error) {
      this.appLogger.error(
        `Failed to confirm pickup for order ${orderId}: ${(error as Error).message}`,
        'OrderService',
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * TGTG Model: Cancel order with time-based refund policy
   *
   * Cancellation Rules:
   * - RESERVED orders: Consumer can cancel with full refund if 1+ hour before pickup
   * - Within 1 hour of pickup: Cancellation NOT allowed (protect merchants)
   * - Merchants can always cancel (no refund to consumer for merchant cancellation)
   * - Legacy PENDING/CONFIRMED orders: Standard cancellation (backward compatibility)
   */
  async cancel(
    orderId: string,
    cancelDto: CancelOrderDto,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId, userId, userRole);

    // Cannot cancel orders that are already completed, cancelled, or expired
    if (
      [OrderStatus.PICKED_UP, OrderStatus.CANCELLED, OrderStatus.EXPIRED].includes(order.status)
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    // Authorization checks
    if (userRole === UserRole.CONSUMER && order.customerId._id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (userRole === UserRole.MERCHANT && order.merchantId._id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // TGTG Model: Time-based cancellation for RESERVED orders (consumer cancellation)
    if (order.status === OrderStatus.RESERVED && userRole === UserRole.CONSUMER) {
      // Calculate time until pickup starts
      const pickupStartTime = this.calculatePickupStartTime(order);
      const now = new Date();
      const hoursUntilPickup = (pickupStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Consumer cannot cancel within 1 hour of pickup
      if (hoursUntilPickup < 1) {
        throw new BadRequestException({
          message: 'Cannot cancel order within 1 hour of pickup time',
          code: 'CANCELLATION_WINDOW_CLOSED',
          pickupStartTime: pickupStartTime.toISOString(),
          hoursRemaining: Math.max(0, hoursUntilPickup).toFixed(2),
        });
      }

      // Process cancellation with full refund using transaction
      const session = await this.orderModel.db.startSession();

      try {
        await session.withTransaction(async () => {
          // 1. Release reserved inventory
          const releasedOffers = await Promise.all(
            order.items.map(item =>
              this.offerModel.findByIdAndUpdate(
                item.offerId,
                { $inc: { reservedQuantity: -item.quantity } },
                { session, new: true },
              ),
            ),
          );

          // Revert sold_out → active if bags became available again
          await this.autoUpdateOfferSoldOutStatus(releasedOffers as OfferDocument[], session);

          // 2. Process refund via RefundService
          const refundResult = await this.refundService.processCancelledOrderRefund(
            orderId,
            cancelDto.reason || 'Consumer cancellation',
            session,
          );

          if (!refundResult.success && refundResult.paymentId) {
            // Schedule retry if refund failed but order should still be cancelled
            if (refundResult.willRetry === true) {
              await this.refundService.scheduleRefundRetry(refundResult.paymentId);
            }
            this.appLogger.warn(
              `Refund failed during consumer cancellation for order ${orderId}: ${refundResult.error}`,
              'OrdersService.cancel',
            );
          } else if (refundResult.success) {
            this.appLogger.log(
              `Refund processed for cancelled order ${orderId}: ${refundResult.amount} TND`,
              'OrdersService.cancel',
            );
          }

          // 3. Update order status (done by refundService, but ensure it's cancelled)
          await this.orderModel.findByIdAndUpdate(
            orderId,
            {
              status: OrderStatus.CANCELLED,
              cancellationReason: cancelDto.reason,
              merchantNotes: cancelDto.additionalNotes,
              cancelledAt: new Date(),
              cancelledBy: 'consumer',
            },
            { session },
          );
        });

        return this.findById(orderId);
      } finally {
        await session.endSession();
      }
    }

    // Merchant cancellation or legacy order cancellation (PENDING/CONFIRMED)
    // For merchant cancellation of RESERVED orders: no refund processed here
    // (merchant should contact support for edge cases)
    const [, ...releasedOffers] = await Promise.all([
      this.orderModel.findByIdAndUpdate(orderId, {
        status: OrderStatus.CANCELLED,
        cancellationReason: cancelDto.reason,
        merchantNotes: cancelDto.additionalNotes,
        cancelledAt: new Date(),
        cancelledBy: userRole === UserRole.MERCHANT ? 'merchant' : 'consumer',
      }),
      ...order.items.map(item =>
        this.offerModel.findByIdAndUpdate(
          item.offerId,
          {
            $inc: { reservedQuantity: -item.quantity },
          },
          { new: true },
        ),
      ),
    ]);

    // Revert sold_out → active if bags became available again
    await this.autoUpdateOfferSoldOutStatus(releasedOffers as OfferDocument[]);

    return this.findById(orderId);
  }

  /**
   * Calculate the pickup start time from order details
   * Uses scheduledDate + timeSlot.startTime
   */
  private calculatePickupStartTime(order: OrderDocument): Date {
    const pickupDate = new Date(order.pickupDetails.scheduledDate);
    const [startHour = '0', startMinute = '0'] = order.pickupDetails.timeSlot.startTime.split(':');
    pickupDate.setHours(parseInt(startHour, 10), parseInt(startMinute, 10), 0, 0);
    return pickupDate;
  }
  async softDeleteOrder(orderId: string, adminId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status === OrderStatus.CANCELLED || order.isDeleted) {
      throw new BadRequestException(`Order is already cancelled or deleted`);
    }

    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = adminId;

    await order.save();

    return order;
  }
  async getOrderStats(
    userId: string,
    userRole: UserRole,
    startDate?: Date,
    establishmentId?: string,
  ): Promise<OrderStatsResponse> {
    let matchCondition: Record<string, unknown>;

    if (userRole === UserRole.MERCHANT) {
      matchCondition = { merchantId: new Types.ObjectId(userId) };
      if (establishmentId) {
        matchCondition['establishmentId'] = new Types.ObjectId(establishmentId);
      }
    } else if (userRole === UserRole.LOCATION_MANAGER && establishmentId) {
      matchCondition = { establishmentId: new Types.ObjectId(establishmentId) };
    } else {
      matchCondition = { customerId: new Types.ObjectId(userId) };
    }

    if (startDate) {
      matchCondition['createdAt'] = { $gte: startDate };
    }

    const stats = await this.orderModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, '$pricing.total', 0],
            },
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.CONFIRMED] }, 1, 0] },
          },
          readyOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.READY_FOR_PICKUP] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] },
          },
          averageOrderValue: { $avg: '$pricing.total' },
          // Sum actual bag quantities from items[] for picked_up orders only
          bagsSaved: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, { $sum: '$items.quantity' }, 0],
            },
          },
        },
      },
    ]);

    const result: OrderStatsResult[] = stats as OrderStatsResult[];
    return (
      result[0] ?? {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        readyOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
        bagsSaved: 0,
      }
    );
  }

  /**
   * Revenue chart aggregation for the merchant dashboard.
   *
   * Supports three granularities:
   *  - 'day'   → `value` = number of days  (max 90)
   *  - 'week'  → `value` = number of weeks (max 52)
   *  - 'month' → `value` = number of months (max 24)
   *
   * Every slot in the returned array is guaranteed to be present, even if
   * revenue is 0 (gap-filled), so the chart always shows a complete axis.
   */
  async getRevenueChart(
    userId: string,
    userRole: UserRole,
    granularity: ChartGranularity,
    value: number,
    establishmentId?: string,
  ): Promise<RevenueChartResponse[]> {
    let matchCondition: Record<string, unknown>;

    if (userRole === UserRole.MERCHANT) {
      matchCondition = { merchantId: new Types.ObjectId(userId) };
      if (establishmentId) {
        matchCondition['establishmentId'] = new Types.ObjectId(establishmentId);
      }
    } else if (userRole === UserRole.LOCATION_MANAGER && establishmentId) {
      matchCondition = { establishmentId: new Types.ObjectId(establishmentId) };
    } else {
      matchCondition = {};
    }

    const now = new Date();
    let startDate: Date;
    let groupId: Record<string, unknown>;
    let sortStage: Record<string, 1 | -1>;

    switch (granularity) {
      case 'day': {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - (value - 1));
        startDate.setHours(0, 0, 0, 0);
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
        sortStage = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
        break;
      }
      case 'week': {
        // Align to the Monday of the current week, then go back (value-1) weeks.
        const dow = now.getDay() || 7; // 1 = Mon … 7 = Sun
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - dow + 1);
        thisMonday.setHours(0, 0, 0, 0);
        startDate = new Date(thisMonday);
        startDate.setDate(thisMonday.getDate() - (value - 1) * 7);
        groupId = {
          isoWeekYear: { $isoWeekYear: '$createdAt' },
          week: { $isoWeek: '$createdAt' },
        };
        sortStage = { '_id.isoWeekYear': 1, '_id.week': 1 };
        break;
      }
      case 'month':
      default: {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - (value - 1));
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        groupId = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
        sortStage = { '_id.year': 1, '_id.month': 1 };
        break;
      }
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...matchCondition,
          status: OrderStatus.PICKED_UP,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: '$pricing.total' },
          orderCount: { $sum: 1 },
          bagCount: { $sum: { $sum: '$items.quantity' } },
        },
      },
      { $sort: sortStage },
    ];

    const results = await this.orderModel.aggregate<{
      _id: Record<string, number>;
      revenue: number;
      orderCount: number;
      bagCount: number;
    }>(pipeline);

    return this.fillChartGaps(granularity, value, now, results);
  }

  /**
   * Returns ISO week number and year (ISO 8601) for the given date.
   * The ISO week containing January 4th is always week 1 of the year.
   */
  private getIsoWeek(d: Date): { isoWeekYear: number; isoWeek: number } {
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dow = utc.getUTCDay() || 7; // 1 = Mon … 7 = Sun
    utc.setUTCDate(utc.getUTCDate() + 4 - dow); // move to Thursday (defines ISO week year)
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return { isoWeekYear: utc.getUTCFullYear(), isoWeek };
  }

  /**
   * Builds a fully-gapless array of `RevenueChartResponse` entries.
   * Missing slots (no orders in that period) are emitted with revenue = 0.
   */
  private fillChartGaps(
    granularity: ChartGranularity,
    value: number,
    now: Date,
    results: Array<{
      _id: Record<string, number>;
      revenue: number;
      orderCount: number;
      bagCount: number;
    }>,
  ): RevenueChartResponse[] {
    const output: RevenueChartResponse[] = [];

    switch (granularity) {
      case 'day': {
        for (let i = value - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const year = d.getFullYear();
          const month = d.getMonth() + 1; // 1-indexed
          const day = d.getDate();
          const found = results.find(
            r => r._id['year'] === year && r._id['month'] === month && r._id['day'] === day,
          );
          output.push({
            label: `${day} ${CHART_MONTH_NAMES[month - 1]}`,
            year,
            month,
            day,
            revenue: found?.revenue ?? 0,
            orderCount: found?.orderCount ?? 0,
            bagCount: found?.bagCount ?? 0,
          });
        }
        break;
      }
      case 'week': {
        const dow = now.getDay() || 7;
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - dow + 1);
        thisMonday.setHours(0, 0, 0, 0);

        for (let i = value - 1; i >= 0; i--) {
          const monday = new Date(thisMonday);
          monday.setDate(thisMonday.getDate() - i * 7);
          const { isoWeekYear, isoWeek } = this.getIsoWeek(monday);
          const month = monday.getMonth() + 1;
          const found = results.find(
            r => r._id['isoWeekYear'] === isoWeekYear && r._id['week'] === isoWeek,
          );
          output.push({
            // Label = Monday's date — e.g. "17 Feb"
            label: `${monday.getDate()} ${CHART_MONTH_NAMES[monday.getMonth()]}`,
            year: isoWeekYear,
            month,
            week: isoWeek,
            revenue: found?.revenue ?? 0,
            orderCount: found?.orderCount ?? 0,
            bagCount: found?.bagCount ?? 0,
          });
        }
        break;
      }
      case 'month':
      default: {
        for (let i = value - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const found = results.find(r => r._id['year'] === year && r._id['month'] === month);
          output.push({
            label: CHART_MONTH_NAMES[month - 1] ?? d.toLocaleString('en-US', { month: 'short' }),
            year,
            month,
            revenue: found?.revenue ?? 0,
            orderCount: found?.orderCount ?? 0,
            bagCount: found?.bagCount ?? 0,
          });
        }
        break;
      }
    }

    return output;
  }

  /**
   * Customer location aggregation from merchant orders.
   * Groups customers by city from their populated address or establishment address.
   */
  async getCustomerLocations(
    userId: string,
    userRole: UserRole,
    limit: number = 5,
    startDate?: Date,
    assignedEstablishmentId?: string,
  ): Promise<CustomerLocationResponse[]> {
    const matchCondition: Record<string, unknown> =
      userRole === UserRole.MERCHANT
        ? { merchantId: new Types.ObjectId(userId) }
        : userRole === UserRole.LOCATION_MANAGER && assignedEstablishmentId
          ? { establishmentId: new Types.ObjectId(assignedEstablishmentId) }
          : {};

    if (startDate) {
      matchCondition['createdAt'] = { $gte: startDate };
    }

    const pipeline: PipelineStage[] = [
      { $match: matchCondition },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
          pipeline: [{ $project: { 'address.city': 1 } }],
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$establishment.address.city', 'Unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          city: '$_id',
          count: 1,
        },
      },
    ];

    const locations = await this.orderModel.aggregate(pipeline);
    return locations as CustomerLocationResponse[];
  }

  async updateExpiredOrders(): Promise<number> {
    const now = new Date();

    // ✅ OPTIMIZATION: Process in batches with .lean() to prevent memory issues
    const BATCH_SIZE = 100;
    let updatedCount = 0;
    let batchNumber = 0;

    while (true) {
      batchNumber++;

      const expiredOrders = await this.orderModel
        .find({
          expiresAt: { $lte: now },
          status: {
            $nin: [
              OrderStatus.EXPIRED,
              OrderStatus.PICKED_UP,
              OrderStatus.CANCELLED,
              OrderStatus.REFUNDED,
            ],
          },
        })
        .select('_id items') // ✅ Only fetch required fields
        .lean() // ✅ 50% memory reduction
        .limit(BATCH_SIZE)
        .exec();

      if (expiredOrders.length === 0) {
        break;
      }

      // Update each expired order in batch
      for (const order of expiredOrders) {
        try {
          const releasedOffers = await Promise.all(
            order.items.map((item: OrderItem) =>
              this.offerModel.findByIdAndUpdate(
                item.offerId,
                {
                  $inc: { reservedQuantity: -item.quantity },
                },
                { new: true },
              ),
            ),
          );

          // Revert sold_out → active if bags became available
          await this.autoUpdateOfferSoldOutStatus(releasedOffers as OfferDocument[]);

          await this.orderModel.findByIdAndUpdate(order._id, {
            status: OrderStatus.EXPIRED,
            expiredAt: now,
            cancellationReason: 'Order expired automatically',
          });

          updatedCount++;
        } catch (error) {
          this.appLogger.error(
            `Failed to update expired order ${order._id}: ${(error as Error).message}`,
            'OrderService',
          );
        }
      }

      this.logger.log(`Batch ${batchNumber}: Updated ${expiredOrders.length} expired orders`);

      if (expiredOrders.length < BATCH_SIZE) {
        break;
      }
    }

    this.logger.log(`✅ Total expired orders updated: ${updatedCount} in ${batchNumber} batches`);
    return updatedCount;
  }
  // =========================================================================
  // REUSABLE $lookup PIPELINE BUILDERS (replaces .populate() — 1 round-trip)
  // =========================================================================

  /**
   * Build $lookup stages for customer population on orders.
   * Overwrites `customerId` ObjectId with populated user object.
   */
  private buildCustomerLookup(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$customerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            {
              $project: { _id: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, avatar: 1 },
            },
          ],
          as: '_customerDoc',
        },
      },
      { $unwind: { path: '$_customerDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { customerId: '$_customerDoc' } },
      { $project: { _customerDoc: 0 } },
    ];
  }

  /**
   * Build $lookup stages for establishment population on orders.
   * Overwrites `establishmentId` ObjectId with populated establishment object.
   */
  private buildEstablishmentLookupForOrder(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'establishments',
          let: { refId: '$establishmentId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                address: 1,
                phoneNumber: 1,
                type: 1,
                images: 1,
                averageRating: 1,
              },
            },
          ],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { establishmentId: '$_establishmentDoc' } },
      { $project: { _establishmentDoc: 0 } },
    ];
  }

  /**
   * Build $lookup stages for merchant population on orders.
   * Overwrites `merchantId` ObjectId with populated user object.
   */
  private buildMerchantLookupForOrder(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$merchantId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1 } },
          ],
          as: '_merchantDoc',
        },
      },
      { $unwind: { path: '$_merchantDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { merchantId: '$_merchantDoc' } },
      { $project: { _merchantDoc: 0 } },
    ];
  }

  /**
   * Build $lookup stages for populating `items[].offerId` with offer details.
   * Single $lookup fetches all referenced offers, then $map assigns each back.
   *
   * @param includeWeight - Include estimatedWeight in projection (for detail view)
   */
  private buildItemsOfferLookup(includeWeight = false): PipelineStage[] {
    const offerProject: Record<string, 1> = { _id: 1, title: 1, images: 1, type: 1 };
    if (includeWeight) {
      offerProject['estimatedWeight'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'offers',
          let: { offerIds: '$items.offerId' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$offerIds'] } } },
            { $project: offerProject },
          ],
          as: '_populatedOffers',
        },
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    offerId: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$_populatedOffers',
                            as: 'o',
                            cond: { $eq: ['$$o._id', '$$item.offerId'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { _populatedOffers: 0 } },
    ];
  }

  /**
   * After any quantity change (reserve, release, sold), check each offer and
   * atomically transition:
   *   ACTIVE   → SOLD_OUT  when availableQuantity <= 0
   *   SOLD_OUT → ACTIVE    when availableQuantity > 0
   *
   * Mongoose pre-save hooks don't fire for findByIdAndUpdate, so this must
   * be called explicitly after every $inc on reservedQuantity / soldQuantity.
   */
  private async autoUpdateOfferSoldOutStatus(
    offers: (OfferDocument | null)[],
    session?: ClientSession,
  ): Promise<void> {
    for (const offer of offers) {
      if (!offer) {
        continue;
      }
      const available = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;

      const opts = session ? { session } : {};
      if (available <= 0 && offer.status === OfferStatus.ACTIVE) {
        await this.offerModel.findByIdAndUpdate(offer._id, { status: OfferStatus.SOLD_OUT }, opts);
        this.appLogger.log(
          `Offer ${offer._id} auto-transitioned to SOLD_OUT (available=${available})`,
          'OrderService',
        );
      } else if (available > 0 && offer.status === OfferStatus.SOLD_OUT) {
        await this.offerModel.findByIdAndUpdate(offer._id, { status: OfferStatus.ACTIVE }, opts);
        this.appLogger.log(
          `Offer ${offer._id} auto-reverted to ACTIVE (available=${available})`,
          'OrderService',
        );
      }
    }
  }

  private async validateAndBuildOrderItems(
    createOrderDto: CreateOrderDto,
    session: ClientSession,
  ): Promise<{
    orderItems: OrderItemProcessed[];
    subtotal: number;
    totalDiscountAmount: number;
    updates: OrderQuantityUpdate[];
    earliestOfferExpiry: Date;
  }> {
    const pickupDate = new Date(createOrderDto.pickupDate);
    const now = new Date();
    const offerIds = createOrderDto.items.map(item => new Types.ObjectId(item.offerId));
    const establishmentId = new Types.ObjectId(createOrderDto.establishmentId);

    // Fetch offers (no populate needed — establishment already fetched in create())
    const offers = await this.offerModel
      .find({
        _id: { $in: offerIds },
        establishmentId,
        status: OfferStatus.ACTIVE,
        availableFrom: { $lte: pickupDate },
        availableUntil: { $gte: pickupDate },
      })
      .session(session);

    if (offers.length !== offerIds.length) {
      throw new BadRequestException('One or more offers are invalid or unavailable');
    }

    // Explicit time guard: reject if any offer has already expired
    // (covers the gap between offer cron runs)
    for (const offer of offers) {
      if (now > new Date(offer.availableUntil)) {
        throw new BadRequestException({
          message: `Offer "${offer.title}" has expired and can no longer accept orders`,
          code: 'OFFER_EXPIRED',
          offerId: offer._id.toString(),
        });
      }
    }

    // Determine earliest offer expiry for order expiresAt calculation
    const firstOffer = offers[0];
    if (!firstOffer) {
      throw new BadRequestException('At least one offer is required to create an order');
    }

    const earliestOfferExpiry = offers.reduce((earliest, offer) => {
      const until = new Date(offer.availableUntil);
      return until < earliest ? until : earliest;
    }, new Date(firstOffer.availableUntil));

    let subtotal = 0;
    let totalDiscountAmount = 0;
    const orderItems: OrderItemProcessed[] = [];
    const validationDetails: ItemValidationDetail[] = [];
    const updates: OrderQuantityUpdate[] = [];

    for (const itemDto of createOrderDto.items) {
      const offer = offers.find(o => o._id.toString() === itemDto.offerId);
      if (!offer) {
        validationDetails.push({
          offerId: new Types.ObjectId(itemDto.offerId),
          reason: `Offer ${itemDto.offerId} not found`,
        });
        continue;
      }

      const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
      if (availableQuantity < itemDto.quantity) {
        validationDetails.push({
          offerId: offer._id,
          reason: `Insufficient quantity. Available: ${availableQuantity}, Requested: ${itemDto.quantity}`,
        });
        continue;
      }

      const selectedSlot = offer.pickupTimeSlots.find(
        slot =>
          slot.startTime.trim() === createOrderDto.pickupTimeSlot.startTime.trim() &&
          slot.endTime.trim() === createOrderDto.pickupTimeSlot.endTime.trim(),
      );

      if (!selectedSlot) {
        validationDetails.push({
          offerId: offer._id,
          reason: 'Selected pickup time slot is not available for this offer',
        });
        continue;
      }

      if (
        selectedSlot.maxOrders !== null &&
        selectedSlot.maxOrders !== undefined &&
        selectedSlot.currentOrders >= selectedSlot.maxOrders
      ) {
        validationDetails.push({
          offerId: offer._id,
          reason: `This pickup slot is full — the restaurant allows a maximum of ${selectedSlot.maxOrders} order${selectedSlot.maxOrders === 1 ? '' : 's'} per slot.`,
        });
        continue;
      }

      const itemTotal = offer.pricing.discountedPrice * itemDto.quantity;
      const itemOriginalTotal = offer.pricing.originalPrice * itemDto.quantity;
      const itemDiscount = itemOriginalTotal - itemTotal;

      subtotal += itemTotal;
      totalDiscountAmount += itemDiscount;

      orderItems.push({
        offerId: offer._id,
        offerTitle: offer.title,
        quantity: itemDto.quantity,
        unitPrice: offer.pricing.discountedPrice,
        totalPrice: itemTotal,
        originalPrice: offer.pricing.originalPrice,
        discountAmount: itemDiscount,
      });

      updates.push({
        offerId: offer._id,
        quantity: itemDto.quantity,
        slotStart: selectedSlot.startTime,
        slotEnd: selectedSlot.endTime,
      });
    }

    if (validationDetails.length > 0) {
      throw new BadRequestException({
        message: 'Validation error: One or more offers are invalid or unavailable',
        details: validationDetails,
      });
    }

    return { orderItems, subtotal, totalDiscountAmount, updates, earliestOfferExpiry };
  }
  private buildPickupDate(date: string, startTime: string): Date {
    const pickupDate = new Date(date);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    pickupDate.setHours(startHour ?? 0, startMinute ?? 0, 0, 0);
    return pickupDate;
  }
  async approveOrdersForExpiration(orderIds: string[], merchantId: string) {
    const result = await this.orderModel.updateMany(
      {
        _id: { $in: orderIds.map(id => new Types.ObjectId(id)) },
        merchantId: new Types.ObjectId(merchantId),
        status: { $ne: OrderStatus.EXPIRED },
      },
      { merchantApprovedExpiration: true },
    );

    return result;
  }
  async handlePickupExtensionApproval(orderId: string, approved: boolean, merchantId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.merchantId.toString() !== merchantId) {
      throw new ForbiddenException('You are not authorized to manage this order');
    }
    if (order.pickupExtensionRequest === null || order.pickupExtensionRequest === undefined) {
      throw new BadRequestException('No extension request found');
    }

    const pickupExtensionRequest = order.pickupExtensionRequest;

    pickupExtensionRequest.approved = approved;
    if (approved) {
      order.pickupDetails.scheduledDate = pickupExtensionRequest.newDate;
    }

    await order.save();
    return { message: approved ? 'Pickup extended' : 'Pickup extension rejected' };
  }

  // =============================================================================
  // PICKUP SECURITY METHODS
  // =============================================================================

  /**
   * Tracks a failed pickup attempt and locks the order if threshold exceeded
   *
   * @param orderId - Order ID
   * @param userId - User who made the attempt
   */
  private async trackFailedPickupAttempt(orderId: string, userId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      return;
    }

    const newAttemptCount = (order.failedPickupAttempts || 0) + 1;
    const shouldLock = newAttemptCount >= this.MAX_FAILED_PICKUP_ATTEMPTS;

    await this.orderModel.findByIdAndUpdate(orderId, {
      failedPickupAttempts: newAttemptCount,
      lastFailedPickupAt: new Date(),
      ...(shouldLock && {
        pickupLocked: true,
        pickupLockedAt: new Date(),
        pickupLockedReason: `Locked after ${newAttemptCount} failed pickup code attempts`,
      }),
    });

    // Log security event
    if (shouldLock) {
      this.appLogger.warn(
        `Order ${orderId} LOCKED: ${newAttemptCount} failed pickup attempts by user ${userId}`,
        'OrderService.PickupSecurity',
      );
    } else {
      this.appLogger.log(
        `Failed pickup attempt ${newAttemptCount}/${this.MAX_FAILED_PICKUP_ATTEMPTS} for order ${orderId} by user ${userId}`,
        'OrderService.PickupSecurity',
      );
    }
  }

  /**
   * Unlocks a pickup-locked order (admin/merchant action)
   *
   * @param orderId - Order ID to unlock
   * @param unlockedBy - User ID of admin/merchant unlocking
   * @returns Updated order
   */
  async unlockPickup(orderId: string, unlockedBy: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.merchantId.toString() !== unlockedBy) {
      throw new ForbiddenException('You are not authorized to unlock this order');
    }

    if (!order.pickupLocked) {
      throw new BadRequestException('Order is not locked');
    }

    await this.orderModel.findByIdAndUpdate(orderId, {
      pickupLocked: false,
      failedPickupAttempts: 0,
      pickupLockedAt: null,
      pickupLockedReason: null,
      $push: {
        'metadata.orderTracking.statusHistory': {
          status: 'pickup_unlocked',
          timestamp: new Date(),
          updatedBy: unlockedBy,
        },
      },
    });

    this.appLogger.log(
      `Order ${orderId} pickup UNLOCKED by ${unlockedBy}`,
      'OrderService.PickupSecurity',
    );

    return this.findById(orderId);
  }

  // =============================================================================
  // ADMIN USER EVENT HANDLERS
  // =============================================================================

  /**
   * Cancel all pending orders for a user (triggered by admin suspension/blocking)
   * Used when admin suspends or blocks a user account
   *
   * @param userId - User ID whose orders should be cancelled
   * @param reason - Reason for cancellation (e.g., "Account suspended by admin")
   * @returns Number of orders cancelled
   */
  async cancelUserPendingOrders(userId: string, reason: string): Promise<number> {
    try {
      const pendingStatuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.READY_FOR_PICKUP,
      ];

      // Find all pending orders for this user
      const ordersToCancel = await this.orderModel
        .find({
          customerId: new Types.ObjectId(userId),
          status: { $in: pendingStatuses },
        })
        .lean();

      if (ordersToCancel.length === 0) {
        this.appLogger.debug(
          `No pending orders to cancel for user ${userId}`,
          'OrderService.cancelUserPendingOrders',
        );
        return 0;
      }

      // Update orders to cancelled status
      const result = await this.orderModel.updateMany(
        {
          customerId: new Types.ObjectId(userId),
          status: { $in: pendingStatuses },
        },
        {
          $set: {
            status: OrderStatus.CANCELLED,
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledBy: 'system',
          },
        },
      );

      this.appLogger.log(
        `Cancelled ${result.modifiedCount} pending orders for user ${userId}. Reason: ${reason}`,
        'OrderService.cancelUserPendingOrders',
      );

      // Process refunds for cancelled orders
      for (const order of ordersToCancel) {
        try {
          // Check if payment needs refund
          const payment = await this.paymentModel.findOne({
            orderId: order._id,
            status: { $in: [PaymentStatus.HELD, PaymentStatus.COMPLETED] },
          });

          if (payment !== null && payment !== undefined) {
            await this.refundService.processFullRefund(payment._id.toString(), reason);
            this.appLogger.log(
              `Initiated refund for order ${order._id.toString()} payment ${payment._id.toString()}`,
              'OrderService.cancelUserPendingOrders',
            );
          }
        } catch (refundError) {
          const refundMessage =
            refundError instanceof Error ? refundError.message : String(refundError);
          this.appLogger.error(
            `Failed to process refund for order ${order._id.toString()}: ${refundMessage}`,
            'OrderService.cancelUserPendingOrders',
          );
          // Continue with other orders even if one refund fails
        }
      }

      return result.modifiedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.appLogger.error(
        `Failed to cancel pending orders for user ${userId}: ${errorMessage}`,
        'OrderService.cancelUserPendingOrders',
      );
      throw error;
    }
  }

  /**
   * Anonymize user data in orders for GDPR compliance (hard delete scenario)
   * Keeps orders for analytics but removes all PII
   *
   * @param userId - User ID whose order data should be anonymized
   */
  async anonymizeUserOrders(userId: string): Promise<void> {
    try {
      const result = await this.orderModel.updateMany(
        { customerId: new Types.ObjectId(userId) },
        {
          $set: {
            'customerInfo.firstName': 'Anonymous',
            'customerInfo.lastName': 'User',
            'customerInfo.email': `deleted-${userId}@privacy.local`,
            'customerInfo.phone': null,
            deliveryAddress: null,
            'pickupDetails.contactPhone': null,
            'pickupDetails.contactEmail': `deleted-${userId}@privacy.local`,
            anonymized: true,
            anonymizedAt: new Date(),
            anonymizationReason: 'User account permanently deleted',
          },
        },
      );

      this.appLogger.log(
        `Anonymized ${result.modifiedCount} orders for deleted user ${userId} (GDPR compliance)`,
        'OrderService.anonymizeUserOrders',
      );

      // Log for compliance audit trail
      this.appLogger.warn(
        `GDPR: User ${userId} order history anonymized - ${result.modifiedCount} orders affected`,
        'OrderService.GDPRCompliance',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.appLogger.error(
        `Failed to anonymize orders for user ${userId}: ${errorMessage}`,
        'OrderService.anonymizeUserOrders',
      );
      throw error;
    }
  }
}
