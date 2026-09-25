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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types, ClientSession, FlattenMaps, PipelineStage, isValidObjectId } from 'mongoose';

import { buildOrderCompletedEvent } from './utils/order-completed-event.util';
import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { AppLoggerService } from '../common/services/logger.service';
import { CacheService } from '../common/services/cache.service';
import { haversineKm } from '../common/utils/geo.util';
import { perfLog, perfStart } from '../common/utils/perf-log.util';

import {
  DEFAULT_DRIVER_SHARE,
  MERCHANT_EARNINGS_EXPR,
  calculateDeliveryEconomics,
  calculateFoodRevenueSplit,
  calculateOrderPricing,
} from './utils/order-pricing.util';
import {
  ORDER_ACCRUED_EXPR,
  ORDER_MERCHANT_AMOUNT_EXPR,
  ORDER_SETTLED_EXPR,
  SALES_BUCKET_EXPR,
  SALES_CHANNEL_EXPR,
  TODAY_SOLD_STATUSES,
  TODAY_TO_COLLECT_STATUSES,
  summariseTodaySales,
  type TodaySalesGroupRow,
  type TodaySalesSummary,
} from './utils/today-sales.util';
import { TimezoneUtil } from '../common/utils/timezone.util';
import {
  assertPaymentMatchesFulfilment,
  resolvePaymentControl,
} from './utils/payment-control.util';
import { ORDER_LIST_FIELDS, ORDER_DETAIL_FIELDS } from '../common/utils/query-optimization.util';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import {
  DELIVERY_ORDER_CREATED,
  DeliveryOrderCreatedEvent,
} from '../drivers/listeners/delivery-order.events';
import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import { NotificationService } from '../notifications/services/notification.service';
import { Offer, OfferDocument, OfferStatus } from '../offers/schemas/offer.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/schemas/payment.schema';
import { KonnectOrderService } from '../payments/services/konnect-order.service';
import { CommissionService } from '../payments/services/commission.service';
import { PayoutService } from '../payments/services/payout.service';
import { RefundService } from '../payments/services/refund.service';
import { PaymentAttempt } from '../payments/schemas/payment-attempt.schema';
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

import { appError } from '../common/errors';
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
  totalEarnings: number;
  totalOriginalValue: number;
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
  earnings: number;
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
  totalEarnings: number;
  /** Retail value of food rescued (sum of items[].originalPrice * quantity for completed orders) */
  totalOriginalValue: number;
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
    @InjectModel(PaymentAttempt.name)
    private readonly paymentAttemptModel: Model<PaymentAttempt>,
    private readonly appLogger: AppLoggerService,
    private readonly regexSecurityUtil: RegexSecurityUtil,
    private readonly payoutService: PayoutService,
    private readonly commissionService: CommissionService,
    private readonly refundService: RefundService,
    private readonly eventBus: EventBusService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WebSocketService)) private readonly webSocketService: WebSocketService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @InjectQueue('pickup-reminders') private readonly pickupReminderQueue: Queue,
    @Inject(forwardRef(() => KonnectOrderService))
    private readonly konnectOrderService: KonnectOrderService,
    private readonly cacheService: CacheService,
  ) {
    void this.POINTS_PER_BAG;
  }

  /**
   * Emits a `[PERF]` timing line for one step of order creation.
   * Silent in production unless PERF_LOGGING=true — see perf-log.util.ts.
   */
  private perf(label: string, startedAt: number, detail?: string): void {
    perfLog(message => this.appLogger.log(message, 'OrderService'), label, startedAt, detail);
  }

  private async invalidateOrderCaches(merchantId: string, customerId: string): Promise<void> {
    await Promise.all([
      this.cacheService.delByPrefix(`orders:stats:${merchantId}`),
      this.cacheService.delByPrefix(`orders:stats:${customerId}`),
      this.cacheService.delByPrefix(`orders:chart:${merchantId}`),
      this.cacheService.delByPrefix(`orders:chart:${customerId}`),
    ]);
  }
  async create(createOrderDto: CreateOrderDto, customerId: string): Promise<OrderDocument> {
    /*
     * Who will hold the customer's money, decided once, before anything is
     * written - an unsupported method or one that contradicts the fulfilment
     * is rejected here rather than stored with a guessed collector. See
     * utils/payment-control.util.ts.
     */
    assertPaymentMatchesFulfilment(
      createOrderDto.paymentMethod,
      createOrderDto.deliveryMode ?? 'pickup',
    );
    const paymentControl = resolvePaymentControl(createOrderDto.paymentMethod);

    const session = await this.orderModel.db.startSession();

    try {
      let finalOrder: OrderDocument | null = null;

      await session.withTransaction(async () => {
        // Fetch customer + establishment + offers in ONE parallel round-trip.
        // The offer query depends only on createOrderDto (offerIds, establishment,
        // pickupDate) — never on the customer/establishment docs — so it is safe to
        // issue concurrently. Collapses two sequential Atlas round-trips into one.
        const tFetch = perfStart();
        const [customer, establishment, offers] = await Promise.all([
          this.userModel.findById(customerId).session(session),
          this.establishmentModel.findById(createOrderDto.establishmentId).session(session),
          this.findActiveOffersForOrder(createOrderDto, session),
        ]);
        this.perf('fetch customer+establishment+offers', tFetch);
        if (!customer) {
          throw new NotFoundException(appError('CUSTOMER_NOT_FOUND'));
        }
        if (!establishment) {
          throw new NotFoundException(appError('ESTABLISHMENT_NOT_FOUND'));
        }

        // Require a phone number for order placement.
        // OTP verification is optional (enabled separately via Twilio).
        if (!customer.phoneNumber) {
          throw new BadRequestException(
            appError('PHONE_VERIFICATION_REQUIRED', undefined, {
              requiresPhoneSetup: true,
              requiresPhoneVerification: false,
            }),
          );
        }
        const tValidate = perfStart();
        const { orderItems, subtotal, totalDiscountAmount, updates, earliestOfferExpiry } =
          this.validateAndBuildOrderItems(createOrderDto, offers);
        this.perf('validateAndBuildOrderItems', tValidate);

        // Reserve stock AND increment the slot counter in a SINGLE atomic
        // findOneAndUpdate per offer. The $elemMatch guarantees the positional
        // `$` targets the exact pickup slot, while $expr enforces availability.
        // This collapses what were two sequential Atlas round-trips into one.
        const tReserve = perfStart();
        const reservationResults = await Promise.all(
          updates.map(update =>
            this.offerModel.findOneAndUpdate(
              {
                _id: update.offerId,
                $expr: {
                  $lte: [
                    { $add: ['$reservedQuantity', update.quantity] },
                    { $subtract: ['$totalQuantity', '$soldQuantity'] },
                  ],
                },
                pickupTimeSlots: {
                  $elemMatch: { startTime: update.slotStart, endTime: update.slotEnd },
                },
              },
              {
                $inc: {
                  reservedQuantity: update.quantity,
                  'pickupTimeSlots.$.currentOrders': 1,
                },
              },
              { session, new: true },
            ),
          ),
        );

        for (let i = 0; i < reservationResults.length; i++) {
          if (!reservationResults[i]) {
            throw new BadRequestException(appError('INSUFFICIENT_STOCK'));
          }
        }
        this.perf('reserve stock + slot increment (parallel)', tReserve);

        // Sold-out status is a derived display flag. It only needs a write when an
        // offer just crossed the availability boundary — the common case is zero
        // writes, so this rarely adds a round-trip.
        const tStatus = perfStart();
        const soldOutUpdates = (reservationResults as OfferDocument[]).flatMap(offer => {
          if (!offer) {
            return [];
          }
          const available = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
          if (available <= 0 && offer.status === OfferStatus.ACTIVE) {
            return [
              this.offerModel.findByIdAndUpdate(
                offer._id,
                { status: OfferStatus.SOLD_OUT },
                { session },
              ),
            ];
          }
          if (available > 0 && offer.status === OfferStatus.SOLD_OUT) {
            return [
              this.offerModel.findByIdAndUpdate(
                offer._id,
                { status: OfferStatus.ACTIVE },
                { session },
              ),
            ];
          }
          return [];
        });

        if (soldOutUpdates.length > 0) {
          await Promise.all(soldOutUpdates);
        }
        this.perf('sold-out status', tStatus, `${soldOutUpdates.length} writes`);

        // 5. Calculate pricing — see orders/utils/order-pricing.util.ts.
        //
        // Customer pays food + deliveryFee. The fee depends ONLY on
        // deliveryMode; payment method is a payment method, not a surcharge.
        const isDelivery = createOrderDto.deliveryMode === 'delivery';
        const driverShare =
          this.configService.get<number>('DELIVERY_DRIVER_SHARE') ?? DEFAULT_DRIVER_SHARE;

        /*
         * Distance is resolved HERE, before pricing, not in the delivery-fields
         * block below where it used to live. The fee now depends on it, and the
         * old order computed the price ~40 lines before the distance existed.
         * Leaving it there and reading it early would have priced every delivery
         * off `undefined` - which the band function floors to the cheapest band,
         * so every delivery would silently have cost 2 TND.
         */
        const deliveryDistanceKm = isDelivery
          ? haversineKm(
              {
                lat: establishment.address.coordinates.coordinates[1] ?? 0,
                lng: establishment.address.coordinates.coordinates[0] ?? 0,
              },
              createOrderDto.deliveryAddress!.coordinates,
            )
          : 0;

        const pricing = calculateOrderPricing({
          subtotal,
          discountAmount: totalDiscountAmount,
          isDelivery,
          deliveryDistanceKm,
          driverShare,
        });

        // 5.1. Charity donation: 5% of the platform's 19% commission on FOOD.
        // Delivery margin is excluded — it funds the driver, not the platform's
        // giving. Formula: subtotal * 0.19 * 0.05 = 0.95% of subtotal.
        const donationAmount = calculateFoodRevenueSplit(subtotal).donation;

        // --- Delivery fields (computed once, never recalculated) ---
        const deliveryEconomics = calculateDeliveryEconomics({
          isDelivery,
          deliveryDistanceKm,
          driverShare,
        });

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

          /*
           * No distance gate. Delivery used to be rejected beyond 5 km with a
           * BadRequestException; it is now available at any distance and the
           * band pricing carries the cost instead of a cutoff.
           *
           * Distance itself is computed above, before pricing needs it.
           */
          deliveryFields = {
            collectionStartTime,
            collectionEndTime,
            estimatedDistanceKm: deliveryDistanceKm,
            // Same numbers the customer was quoted in `pricing.deliveryFee`.
            // Both come from calculateDeliveryEconomics/calculateOrderPricing,
            // so the settlement record and the invoice cannot disagree.
            ...(deliveryEconomics ?? {}),
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
          status:
            createOrderDto.paymentMethod === 'online'
              ? OrderStatus.PENDING_PAYMENT
              : isDelivery
                ? OrderStatus.CONFIRMED
                : OrderStatus.RESERVED,
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
            amount: pricing.total,
            currency: DEFAULT_CURRENCY,
          },
          pricing: {
            ...pricing,
            currency: DEFAULT_CURRENCY,
          },
          establishmentAddress: establishment.address,
          customerNotes: createOrderDto.customerNotes,
          donationAmount, // Add donation tracking
          // Order expires when offer expires + 30min grace period
          expiresAt: new Date(earliestOfferExpiry.getTime() + ORDER_GRACE_PERIOD_MS),
          // Delivery fields — set at creation, never mutated
          deliveryMode: createOrderDto.deliveryMode ?? 'pickup',
          paymentControl,
          ...(createOrderDto.paymentMethod === 'online'
            ? {
                paymentProvider: 'konnect' as const,
                paymentExpiresAt: new Date(
                  Date.now() +
                    this.configService.get<number>('KONNECT_PAYMENT_TIMEOUT_MINUTES', 15) *
                      60 *
                      1000,
                ),
                paymentAttemptSequence: 0,
              }
            : {}),
          ...(createOrderDto.deliveryAddress && {
            deliveryAddress: createOrderDto.deliveryAddress,
          }),
          driverCancellationCount: 0,
          ...deliveryFields,
        });

        const tSave = perfStart();
        const savedOrder = await order.save({ session });
        this.perf('order.save', tSave);

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

      if (finalOrder === null) {
        throw new InternalServerErrorException(appError('ORDER_CREATE_FAILED'));
      }

      const createdOrder: OrderDocument = finalOrder;

      // Cache invalidation is deliberately not awaited — a stale merchant
      // dashboard must never fail an order that is already committed. But the
      // rejection has to surface: without this catch it reaches the global
      // unhandledRejection handler in main.ts, which swallows it silently, so
      // a Redis outage would leave dashboards stale with no diagnostic trail.
      this.invalidateOrderCaches(createdOrder.merchantId.toString(), customerId).catch(
        (err: Error) => {
          this.appLogger.error(
            `Order cache invalidation failed for order ${createdOrder.orderNumber}: ${err.message}`,
            'OrderService.invalidateOrderCaches',
          );
        },
      );

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

      // Delivery orders enter the driver pool immediately (they are created as
      // CONFIRMED). Announce them so nearby online drivers get a push instead of
      // having to wait for their next 30s poll.
      if (createdOrder.deliveryMode === 'delivery') {
        this.eventEmitter.emit(DELIVERY_ORDER_CREATED, {
          order: createdOrder,
        } satisfies DeliveryOrderCreatedEvent);
      }

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

      throw new InternalServerErrorException(appError('ORDER_CREATE_FAILED'));
    } finally {
      await session.endSession();
    }
  }

  private isValidStatusTransition(oldStatus: OrderStatus, newStatus: OrderStatus): boolean {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.PENDING_PAYMENT]: [
        OrderStatus.RESERVED,
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
      ],
      [OrderStatus.RESERVED]: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.COMPLETED,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.READY_FOR_PICKUP]: [
        OrderStatus.PICKED_UP,
        OrderStatus.COMPLETED,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CANCELLED,
      ],
      // Unassign returns a delivery order to CONFIRMED so it re-enters the pool.
      [OrderStatus.DRIVER_ASSIGNED]: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [
        OrderStatus.DELIVERED,
        OrderStatus.COMPLETED,
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PICKED_UP]: [OrderStatus.REFUNDED],
      [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
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

    // 2. Push notification — visible even when app is in background.
    //
    // Queued rather than sent inline: this runs on the order-creation path, and
    // an inline FCM call put a third party's latency in front of the merchant
    // hearing about a new order — and lost the notification outright if that
    // call failed. Bull retries with backoff and survives a restart.
    await this.notificationService.queueNotification({
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
      throw new NotFoundException(appError('ORDER_NOT_FOUND'));
    }

    // Check access permissions
    if (userId && userRole !== UserRole.ADMIN) {
      const isCustomer = order.customerId._id.toString() === userId;
      const isMerchant = order.merchantId._id.toString() === userId;

      if (!isCustomer && !isMerchant) {
        throw new ForbiddenException(appError('ACCESS_DENIED'));
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

    // $sort/$skip/$limit BEFORE $lookup — lookups only run on the page slice,
    // not on every matching document (25x fewer lookups on large result sets).
    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: sort },
      { $skip: skip },
      { $limit: safeLimit },
      { $project: projectStage },
      ...this.buildCustomerLookup(),
      ...this.buildEstablishmentLookupForOrder(),
      ...this.buildItemsOfferLookup(false),
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
      throw new BadRequestException(appError('PICKUP_EXTENSION_NOT_ALLOWED'));
    }

    const parsedDate = new Date(newPickupDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException(appError('INVALID_DATE'));
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

  async findByCustomerCursor(
    customerId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{ orders: OrderLean[]; hasMore: boolean; nextCursor: string | null }> {
    const safeLimit = Math.min(limit, 50);
    const query: Record<string, unknown> = {
      customerId: new Types.ObjectId(customerId),
    };
    if (cursor) {
      query['createdAt'] = { $lt: new Date(cursor) };
    }

    const listFields = ORDER_LIST_FIELDS.split(' ');
    const projectStage: Record<string, 1> = {};
    for (const field of listFields) {
      projectStage[field] = 1;
    }

    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: { createdAt: -1 as const } },
      { $limit: safeLimit + 1 },
      { $project: projectStage },
      ...this.buildCustomerLookup(),
      ...this.buildEstablishmentLookupForOrder(),
      ...this.buildItemsOfferLookup(false),
    ];

    const orders = (await this.orderModel.aggregate(pipeline).exec()) as OrderLean[];
    const hasMore = orders.length > safeLimit;
    if (hasMore) {
      orders.pop();
    }
    const nextCursor =
      hasMore && orders.length > 0
        ? (orders[orders.length - 1] as unknown as { createdAt: Date }).createdAt.toISOString()
        : null;

    return { orders, hasMore, nextCursor };
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
    /*
     * A plain status write moves no money, so it may only make the two moves
     * that carry none. Every other status has its own action that does the
     * work the status implies, and writing the status here skipped all of it:
     *
     * - PICKED_UP  confirm-pickup: pickup code, commission, wallet, loyalty,
     *              the charity contribution
     * - DELIVERED  the driver's markDelivered: collected cash, driver ledger
     * - CANCELLED  cancel: refund of an online payment, stock returned
     * - REFUNDED   the admin refund: provider refund, commission and ledger
     *              reversal, the donation reversal
     *
     * The transition map still allows those moves for the actions that own
     * them; this endpoint is not one of them.
     */
    const target = updateDto.status as OrderStatus;
    if (!OrdersService.PLAIN_STATUS_TARGETS.includes(target)) {
      throw new BadRequestException(appError('ORDER_STATUS_NOT_SETTABLE', { status: target }));
    }

    const order = await this.findById(orderId, userId, userRole);
    if (!this.isValidStatusTransition(order.status, updateDto.status as OrderStatus)) {
      throw new BadRequestException(
        appError('ORDER_INVALID_TRANSITION', { from: order.status, to: updateDto.status }),
      );
    }

    // Role-based permissions
    if (userRole === UserRole.MERCHANT) {
      if (order.merchantId._id.toString() !== userId) {
        throw new ForbiddenException(appError('ACCESS_DENIED'));
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
      throw new NotFoundException(appError('ORDER_NOT_FOUND'));
    }

    void this.invalidateOrderCaches(
      order.merchantId._id.toString(),
      order.customerId._id.toString(),
    );

    return this.findById(updatedOrder._id.toString());
  }

  /** The only statuses `updateStatus` may write - the ones that move no money. */
  private static readonly PLAIN_STATUS_TARGETS: readonly OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.READY_FOR_PICKUP,
  ];

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
      throw new ForbiddenException(
        appError('PICKUP_LOCKED', undefined, {
          lockedAt: order.pickupLockedAt,
          contactSupport: true,
        }),
      );
    }

    // Check if order is ready for pickup (RESERVED, READY_FOR_PICKUP, or CONFIRMED for backward compat)
    const validStatuses = [
      OrderStatus.RESERVED,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.CONFIRMED,
    ];
    if (!validStatuses.includes(order.status)) {
      throw new BadRequestException(appError('ORDER_NOT_READY'));
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
        throw new BadRequestException(appError('CODE_EXPIRED'));
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
        throw new ForbiddenException(appError('PICKUP_OWNER_ONLY'));
      }
    }
    if (userRole === UserRole.MERCHANT) {
      // Merchants MUST provide a qrCode — they cannot rely on pickupCode alone
      if (!confirmDto.qrCode) {
        throw new ForbiddenException(appError('PICKUP_QR_REQUIRED'));
      }
      // And it must belong to this merchant's order
      if (order.merchantId._id.toString() !== userId) {
        throw new ForbiddenException(appError('PICKUP_MERCHANT_ONLY'));
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
      throw new BadRequestException(appError('PICKUP_CODE_INVALID'));
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

        /*
         * One instant for the whole confirmation: the pickup timestamps and the
         * commission decision's `appliedAt` (tested against
         * COMMISSION_MODEL_EFFECTIVE_AT) must never disagree by a few ms.
         *
         * `pickedUpAt` is written explicitly: findOneAndUpdate skips the
         * schema's pre-save hook, so it was never set on this path before.
         */
        const completedAt = new Date();
        const completesAsKonnect = order.paymentProvider === 'konnect';

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
              status: completesAsKonnect ? OrderStatus.COMPLETED : OrderStatus.PICKED_UP,
              'pickupDetails.actualPickupTime': completedAt,
              pickedUpAt: completedAt,
              ...(completesAsKonnect && { completedAt }),
              ...(isCashPayment && { paymentStatus: OrderPaymentStatus.PAID }),
              ...(confirmDto.notes && { customerNotes: confirmDto.notes }),
            },
          },
          { session, new: true },
        );

        if (!claimed) {
          throw new BadRequestException(appError('PICKUP_ALREADY_DONE'));
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

        const paymentHeld = payment?.status === PaymentStatus.HELD;

        /*
         * Commission for EVERY pickup, in this transaction - the settlement
         * reads the balance before writing it, so only snapshot isolation makes
         * two concurrent confirmations safe. CommissionService decides which
         * engine applies: the new model at or after the cutoff (cash and online
         * alike), the pre-cutoff engine before it and only for HELD online
         * payments, exactly as before. `null` = nothing applies, or another
         * worker already applied it.
         */
        const commission = await this.commissionService.applyForOrder(
          {
            establishmentId: order.establishmentId._id,
            merchantId: order.merchantId._id,
            orderId: order._id,
            subtotal: order.pricing.subtotal,
            controlledBy: order.paymentControl?.controlledBy,
            appliedAt: completedAt,
            legacyEligible: paymentHeld,
          },
          session,
        );

        if (payment && paymentHeld) {
          payment.status = PaymentStatus.EARNED;
          payment.earnedAt = completedAt;
          await payment.save({ session });

          /*
           * Online pickup: TFTW holds the customer's money, so the merchant is
           * owed `merchantAmount` through the payout ledger (the source of
           * truth for what TFTW owes merchants). A cash pickup gets no entry -
           * the merchant already holds the full price.
           */
          /*
           * The decision this order was actually given: this worker's, or - when
           * another worker applied it first - the one frozen on the order. Only
           * an order with no decision at all (an integrity failure logged by
           * CommissionService) falls back to the model's NORMAL rule, 100%.
           */
          const decided =
            commission ??
            (await this.orderModel.findById(order._id).select('commission').session(session).lean())
              ?.commission ??
            null;
          const settlement = decided
            ? { merchantAmount: decided.merchantAmount, settled: decided.settled }
            : { merchantAmount: order.pricing.subtotal, settled: 0 };

          const existingLedger = await this.payoutService.findByOrderId(orderId);
          if (!existingLedger) {
            await this.payoutService.createLedgerEntry(
              {
                merchantId: order.merchantId._id,
                orderId: order._id,
                paymentId: payment._id,
                establishmentId: order.establishmentId._id,
                orderTotal: order.pricing.total,
                subtotal: order.pricing.subtotal,
                commissionSettlement: settlement,
              },
              session,
            );
          }

          /*
           * Wallet pending -> available, INSIDE this transaction. It used to run
           * after the commit in a try/catch that only logged, so a failure left
           * the wallet permanently behind the payout ledger.
           */
          await this.konnectOrderService.processPickupConfirmation(
            order,
            settlement.merchantAmount,
            session,
          );

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

      void this.invalidateOrderCaches(
        order.merchantId._id.toString(),
        order.customerId._id.toString(),
      );

      // 5. Emit order completed event for cross-module reactions (loyalty, donations, analytics)
      try {
        await this.eventBus.emit('order.completed', buildOrderCompletedEvent(order, new Date()));
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
    const cancelMerchantId = order.merchantId._id.toString();
    const cancelCustomerId = order.customerId._id.toString();

    if (
      [
        OrderStatus.PICKED_UP,
        OrderStatus.COMPLETED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
      ].includes(order.status)
    ) {
      throw new BadRequestException(appError('ORDER_NOT_CANCELLABLE'));
    }

    // Authorization checks
    if (userRole === UserRole.CONSUMER && order.customerId._id.toString() !== userId) {
      throw new ForbiddenException(appError('ACCESS_DENIED'));
    }
    if (userRole === UserRole.MERCHANT && order.merchantId._id.toString() !== userId) {
      throw new ForbiddenException(appError('ACCESS_DENIED'));
    }

    // Cancel PENDING_PAYMENT order (not yet paid) — expire attempts, release inventory
    if (order.status === OrderStatus.PENDING_PAYMENT) {
      const session = await this.orderModel.db.startSession();
      try {
        await session.withTransaction(async () => {
          await this.paymentAttemptModel.updateMany(
            { orderId: order._id, active: true },
            { status: 'expired', active: false, failedReason: 'Order cancelled' },
            { session },
          );

          const releasedOffers = await Promise.all(
            order.items.map(item =>
              this.offerModel.findByIdAndUpdate(
                item.offerId,
                { $inc: { reservedQuantity: -item.quantity } },
                { session, new: true },
              ),
            ),
          );

          await this.autoUpdateOfferSoldOutStatus(releasedOffers as OfferDocument[], session);

          await this.orderModel.findByIdAndUpdate(
            orderId,
            {
              status: OrderStatus.CANCELLED,
              cancellationReason: cancelDto.reason,
              merchantNotes: cancelDto.additionalNotes,
            },
            { session },
          );
        });
        void this.invalidateOrderCaches(cancelMerchantId, cancelCustomerId);
        return this.findById(orderId);
      } finally {
        await session.endSession();
      }
    }

    // Cancel online-paid order (RESERVED/CONFIRMED with paymentStatus PAID)
    if (order.paymentProvider === 'konnect' && order.paymentStatus === OrderPaymentStatus.PAID) {
      const session = await this.orderModel.db.startSession();
      try {
        await session.withTransaction(async () => {
          const releasedOffers = await Promise.all(
            order.items.map(item =>
              this.offerModel.findByIdAndUpdate(
                item.offerId,
                { $inc: { reservedQuantity: -item.quantity } },
                { session, new: true },
              ),
            ),
          );
          await this.autoUpdateOfferSoldOutStatus(releasedOffers as OfferDocument[], session);

          await this.orderModel.findByIdAndUpdate(
            orderId,
            {
              status: OrderStatus.CANCELLED,
              paymentStatus: OrderPaymentStatus.REFUND_PENDING,
              cancellationReason: cancelDto.reason,
              merchantNotes: cancelDto.additionalNotes,
            },
            { session },
          );

          const isConsumer = userRole === UserRole.CONSUMER;
          await this.konnectOrderService.processRefundRequest(
            order,
            new Types.ObjectId(userId),
            isConsumer ? 'consumer_cancel' : 'merchant_cancel',
            session,
          );
        });
        void this.invalidateOrderCaches(cancelMerchantId, cancelCustomerId);
        return this.findById(orderId);
      } finally {
        await session.endSession();
      }
    }

    // TGTG Model: Time-based cancellation for RESERVED orders (consumer cancellation)
    if (order.status === OrderStatus.RESERVED && userRole === UserRole.CONSUMER) {
      // Calculate time until pickup starts
      const pickupStartTime = this.calculatePickupStartTime(order);
      const now = new Date();
      const hoursUntilPickup = (pickupStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Consumer cannot cancel within 1 hour of pickup
      if (hoursUntilPickup < 1) {
        throw new BadRequestException(
          appError('CANCELLATION_WINDOW_CLOSED', undefined, {
            pickupStartTime: pickupStartTime.toISOString(),
          }),
        );
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

        void this.invalidateOrderCaches(cancelMerchantId, cancelCustomerId);
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

    void this.invalidateOrderCaches(cancelMerchantId, cancelCustomerId);
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
      throw new NotFoundException(appError('ORDER_NOT_FOUND'));
    }

    if (order.status === OrderStatus.CANCELLED || order.isDeleted) {
      throw new BadRequestException(appError('ORDER_ALREADY_CANCELLED'));
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

    const cacheKey = `orders:stats:${userId}:${startDate?.toISOString() ?? 'all'}:${establishmentId ?? 'all'}`;

    const cached = await this.cacheService.getOrSet<OrderStatsResponse>(
      cacheKey,
      async () => {
        const stats = await this.orderModel.aggregate([
          { $match: matchCondition },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
                      ],
                    },
                    '$pricing.total',
                    0,
                  ],
                },
              },
              totalEarnings: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
                      ],
                    },
                    MERCHANT_EARNINGS_EXPR,
                    0,
                  ],
                },
              },
              totalOriginalValue: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
                      ],
                    },
                    {
                      $reduce: {
                        input: '$items',
                        initialValue: 0,
                        in: {
                          $add: [
                            '$$value',
                            { $multiply: ['$$this.originalPrice', '$$this.quantity'] },
                          ],
                        },
                      },
                    },
                    0,
                  ],
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
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] },
              },
              averageOrderValue: { $avg: '$pricing.total' },
              bagsSaved: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
                      ],
                    },
                    { $sum: '$items.quantity' },
                    0,
                  ],
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
            totalEarnings: 0,
            totalOriginalValue: 0,
            pendingOrders: 0,
            confirmedOrders: 0,
            readyOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            averageOrderValue: 0,
            bagsSaved: 0,
          }
        );
      },
      120,
    );
    return cached;
  }

  /**
   * Today's sales for the merchant dashboard: cash and online together.
   *
   * "Today" is the merchant's calendar day in Africa/Tunis, by order creation.
   * Offers are same-day and an order expires 30 minutes after its offer, so an
   * order created today is sold, collected or lost today.
   *
   * Scoping mirrors `getOrderStats`: a merchant sees their own orders, narrowed
   * to one establishment when given; a location manager sees only the
   * establishment they are assigned to (resolved by the controller).
   */
  async getTodaySales(
    userId: string,
    userRole: UserRole,
    establishmentId?: string,
    now: Date = new Date(),
  ): Promise<TodaySalesSummary> {
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });

    const match: Record<string, unknown> = {
      createdAt: { $gte: TimezoneUtil.getStartOfDay(now), $lte: now },
      status: { $in: [...TODAY_SOLD_STATUSES, ...TODAY_TO_COLLECT_STATUSES] },
      isDeleted: { $ne: true },
    };

    if (userRole === UserRole.LOCATION_MANAGER) {
      // No assignment means nothing to show - never fall through to "all".
      if (!establishmentId || !isValidObjectId(establishmentId)) {
        return summariseTodaySales([], date);
      }
      match['establishmentId'] = new Types.ObjectId(establishmentId);
    } else {
      match['merchantId'] = new Types.ObjectId(userId);
      if (establishmentId) {
        if (!isValidObjectId(establishmentId)) {
          throw new BadRequestException(appError('INVALID_ID'));
        }
        match['establishmentId'] = new Types.ObjectId(establishmentId);
      }
    }

    const rows = await this.orderModel.aggregate<TodaySalesGroupRow>([
      { $match: match },
      {
        $group: {
          _id: { bucket: SALES_BUCKET_EXPR, channel: SALES_CHANNEL_EXPR },
          orders: { $sum: 1 },
          sales: { $sum: { $ifNull: ['$pricing.subtotal', 0] } },
          accrued: { $sum: ORDER_ACCRUED_EXPR },
          settled: { $sum: ORDER_SETTLED_EXPR },
          merchantAmount: { $sum: ORDER_MERCHANT_AMOUNT_EXPR },
        },
      },
    ]);

    return summariseTodaySales(rows, date);
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

    const cacheKey = `orders:chart:${userId}:${granularity}:${value}:${establishmentId ?? 'all'}`;

    const cached = await this.cacheService.getOrSet<RevenueChartResponse[]>(
      cacheKey,
      async () => {
        const pipeline: PipelineStage[] = [
          {
            $match: {
              ...matchCondition,
              status: {
                $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED, OrderStatus.DELIVERED],
              },
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: groupId,
              revenue: { $sum: '$pricing.total' },
              earnings: { $sum: MERCHANT_EARNINGS_EXPR },
              orderCount: { $sum: 1 },
              bagCount: { $sum: { $sum: '$items.quantity' } },
            },
          },
          { $sort: sortStage },
        ];

        const results = await this.orderModel.aggregate<{
          _id: Record<string, number>;
          revenue: number;
          earnings: number;
          orderCount: number;
          bagCount: number;
        }>(pipeline);

        return this.fillChartGaps(granularity, value, now, results);
      },
      120,
    );
    return cached;
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
      earnings: number;
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
            earnings: found?.earnings ?? 0,
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
            earnings: found?.earnings ?? 0,
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
            earnings: found?.earnings ?? 0,
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
              OrderStatus.COMPLETED,
              OrderStatus.DELIVERED,
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

  /**
   * Fetch the active, in-window offers referenced by an order. Split out from
   * validateAndBuildOrderItems so it can be issued in parallel with the
   * customer/establishment lookups (it depends only on the DTO).
   */
  private async findActiveOffersForOrder(
    createOrderDto: CreateOrderDto,
    session: ClientSession,
  ): Promise<OfferDocument[]> {
    const pickupDate = new Date(createOrderDto.pickupDate);
    const offerIds = createOrderDto.items.map(item => new Types.ObjectId(item.offerId));
    const establishmentId = new Types.ObjectId(createOrderDto.establishmentId);

    const offers = await this.offerModel
      .find({
        _id: { $in: offerIds },
        establishmentId,
        status: OfferStatus.ACTIVE,
        availableFrom: { $lte: pickupDate },
        availableUntil: { $gte: pickupDate },
      })
      .select(
        '_id title pricing totalQuantity reservedQuantity soldQuantity pickupTimeSlots availableUntil',
      )
      .session(session)
      .exec();
    return offers;
  }

  private validateAndBuildOrderItems(
    createOrderDto: CreateOrderDto,
    offers: OfferDocument[],
  ): {
    orderItems: OrderItemProcessed[];
    subtotal: number;
    totalDiscountAmount: number;
    updates: OrderQuantityUpdate[];
    earliestOfferExpiry: Date;
  } {
    const now = new Date();

    if (offers.length !== createOrderDto.items.length) {
      throw new BadRequestException(appError('ORDER_OFFERS_UNAVAILABLE'));
    }

    // Explicit time guard: reject if any offer has already expired
    // (covers the gap between offer cron runs)
    for (const offer of offers) {
      if (now > new Date(offer.availableUntil)) {
        throw new BadRequestException(
          appError('OFFER_EXPIRED', undefined, { offerId: offer._id.toString() }),
        );
      }
    }

    // Determine earliest offer expiry for order expiresAt calculation
    const firstOffer = offers[0];
    if (!firstOffer) {
      throw new BadRequestException(appError('ORDER_NEEDS_OFFER'));
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
      // The per-offer reasons are internal (ids, stock numbers); logged, not sent.
      this.appLogger.warn(
        `Order validation failed: ${JSON.stringify(validationDetails)}`,
        'OrderService',
      );
      throw new BadRequestException(appError('ORDER_OFFERS_UNAVAILABLE'));
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
      throw new NotFoundException(appError('ORDER_NOT_FOUND'));
    }
    if (order.merchantId.toString() !== merchantId) {
      throw new ForbiddenException(appError('ORDER_NOT_YOURS'));
    }
    if (order.pickupExtensionRequest === null || order.pickupExtensionRequest === undefined) {
      throw new BadRequestException(appError('PICKUP_EXTENSION_NOT_FOUND'));
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
      throw new NotFoundException(appError('ORDER_NOT_FOUND'));
    }

    if (order.merchantId.toString() !== unlockedBy) {
      throw new ForbiddenException(appError('ORDER_NOT_YOURS'));
    }

    if (!order.pickupLocked) {
      throw new BadRequestException(appError('ORDER_NOT_LOCKED'));
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
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.CONFIRMED,
        OrderStatus.READY_FOR_PICKUP,
      ];

      const ordersToCancel = await this.orderModel
        .find({
          customerId: new Types.ObjectId(userId),
          status: { $in: pendingStatuses },
        })
        .select('_id items merchantId')
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

      const merchantIds = [...new Set(ordersToCancel.map(o => o.merchantId.toString()))];
      // Not awaited — the cancellations already committed — but caught, so a
      // Redis outage is logged rather than swallowed by the global
      // unhandledRejection handler in main.ts.
      Promise.all(
        [
          `orders:stats:${userId}`,
          `orders:chart:${userId}`,
          ...merchantIds.flatMap(mid => [`orders:stats:${mid}`, `orders:chart:${mid}`]),
        ].map(async prefix => {
          await this.cacheService.delByPrefix(prefix);
        }),
      ).catch((err: unknown) => {
        this.appLogger.error(
          `Cache invalidation failed after cancelling orders for user ${userId}: ${String(err)}`,
          'OrderService.cancelUserPendingOrders',
        );
      });

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
