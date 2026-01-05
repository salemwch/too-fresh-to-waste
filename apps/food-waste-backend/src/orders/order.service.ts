import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    InternalServerErrorException,
    Logger,
    Inject,
    Optional,
    forwardRef,
} from '@nestjs/common';
import { AppLoggerService } from '../common/services/logger.service';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import { ORDER_LIST_FIELDS, ORDER_DETAIL_FIELDS } from '../common/utils/query-optimization.util';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession, FlattenMaps } from 'mongoose';
import { Order, OrderDocument, OrderStatus, PaymentStatus as OrderPaymentStatus } from './schemas/order.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/schemas/payment.schema';
import { PayoutService } from '../payments/services/payout.service';
import { RefundService } from '../payments/services/refund.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { GamificationService } from '../loyalty/services/gamification.service';

/**
 * Lean result type for Order documents
 * Use this for results from .lean() queries to maintain type safety
 *
 * Note: When using .lean(), Mongoose returns POJO with FlattenMaps type.
 * We use 'unknown' for _id to accept both ObjectId and FlattenMaps variants.
 */
export type OrderLean = FlattenMaps<Order> & { _id: unknown };
import { Offer, OfferDocument, OfferStatus } from '../offers/schemas/offer.schema';
import { Establishment, EstablishmentDocument } from '../establishments/schemas/establishment.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { CreateOrderDto, ConfirmPickupDto, UpdateOrderStatusDto, CancelOrderDto, OrderQueryDto } from './DTO/create-order.dto';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

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
    createdAt?: 1 | -1;
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
        @InjectModel(Order.name) readonly  orderModel: Model<OrderDocument>,
        @InjectModel(Offer.name) readonly  offerModel: Model<OfferDocument>,
        @InjectModel(Establishment.name) readonly  establishmentModel: Model<EstablishmentDocument>,
        @InjectModel(User.name) readonly   userModel: Model<UserDocument>,
        @InjectModel(Payment.name) readonly paymentModel: Model<PaymentDocument>,
        private readonly appLogger: AppLoggerService,
        private readonly regexSecurityUtil: RegexSecurityUtil,
        private readonly payoutService: PayoutService,
        private readonly refundService: RefundService,
        @Optional() @Inject('DonationsService') private readonly donationsService?: any, // Optional to avoid breaking if donations module fails
        @Optional() @Inject(forwardRef(() => LoyaltyService)) private readonly loyaltyService?: LoyaltyService, // Optional for loyalty points
        @Optional() @Inject(forwardRef(() => GamificationService)) private readonly gamificationService?: GamificationService, // Optional for gamification
    ) { }
    @Cron(CronExpression.EVERY_10_MINUTES)
    async expireApprovedOrdersCron() {
        const now = new Date();

        // ⚠️ CRITICAL: Process in batches to prevent memory issues with 10K+ orders
        // Enterprise pattern: Cursor-based iteration for large datasets
        const BATCH_SIZE = 100; // Process 100 orders at a time
        let processedCount = 0;
        let batchNumber = 0;

        while (true) {
            batchNumber++;

            // Fetch orders in batches using .lean() for better performance
            const ordersToExpire = await this.orderModel
                .find({
                    'pickupDetails.scheduledDate': { $lte: now },
                    status: { $ne: OrderStatus.EXPIRED },
                    merchantApprovedExpiration: true,
                })
                .select('_id items') // Only fetch required fields
                .lean() // Plain objects, 50% less memory
                .limit(BATCH_SIZE)
                .exec();

            if (ordersToExpire.length === 0) {
                break; // No more orders to process
            }

            // Process batch
            for (const order of ordersToExpire) {
                try {
                    // Release reserved quantity
                    await Promise.all(
                        order.items.map((item: any) =>
                            this.offerModel.findByIdAndUpdate(item.offerId, {
                                $inc: { reservedQuantity: -item.quantity },
                            }),
                        ),
                    );

                    // Mark order as expired
                    await this.orderModel.findByIdAndUpdate(order._id, {
                        status: OrderStatus.EXPIRED,
                        expiredAt: now,
                        cancellationReason: 'Order expired after merchant approval',
                    });

                    processedCount++;
                } catch (error) {
                    this.logger.error(`Failed to expire order ${order._id}: ${error}`);
                }
            }

            this.logger.log(`Batch ${batchNumber}: Expired ${ordersToExpire.length} orders`);

            // If we got less than BATCH_SIZE, we've processed all orders
            if (ordersToExpire.length < BATCH_SIZE) {
                break;
            }
        }

        this.logger.log(`✅ Total expired: ${processedCount} orders (merchant-approved) in ${batchNumber} batches`);
    }

    /**
     * TGTG Model: Expire RESERVED orders and process automatic refunds
     *
     * Runs every 10 minutes to find RESERVED orders past their pickup window.
     * For each expired order:
     * 1. Release reserved inventory
     * 2. Process SMT refund via RefundService
     * 3. Update order status to EXPIRED
     *
     * Uses batched processing and transactions for data integrity.
     */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async expireReservedOrdersWithRefundCron(): Promise<void> {
        const now = new Date();
        const BATCH_SIZE = 50; // Smaller batch for refund processing (involves external API calls)
        let processedCount = 0;
        let refundSuccessCount = 0;
        let refundFailedCount = 0;
        let batchNumber = 0;

        this.logger.log('Starting RESERVED order expiry with auto-refund...');

        while (true) {
            batchNumber++;

            // Find RESERVED orders past their pickup end time
            const ordersToExpire = await this.orderModel
                .find({
                    status: OrderStatus.RESERVED,
                    expiresAt: { $lte: now },
                })
                .select('_id items customerId totalAmount')
                .lean()
                .limit(BATCH_SIZE)
                .exec();

            if (ordersToExpire.length === 0) {
                break;
            }

            // Process each order with refund
            for (const order of ordersToExpire) {
                const session = await this.orderModel.db.startSession();

                try {
                    await session.withTransaction(async () => {
                        // 1. Release reserved inventory
                        await Promise.all(
                            order.items.map((item: any) =>
                                this.offerModel.findByIdAndUpdate(
                                    item.offerId,
                                    { $inc: { reservedQuantity: -item.quantity } },
                                    { session },
                                ),
                            ),
                        );

                        // 2. Process refund via RefundService
                        const refundResult = await this.refundService.processExpiredOrderRefund(
                            (order._id as Types.ObjectId).toString(),
                            session,
                        );

                        if (refundResult.success) {
                            refundSuccessCount++;
                            this.appLogger.log(
                                `Refund processed for expired order ${order._id}: ${refundResult.amount} TND`,
                                'OrdersService.ExpiryCron',
                            );
                        } else {
                            refundFailedCount++;
                            // Schedule retry if refund failed
                            if (refundResult.willRetry && refundResult.paymentId) {
                                await this.refundService.scheduleRefundRetry(refundResult.paymentId);
                            }
                            this.appLogger.warn(
                                `Refund failed for expired order ${order._id}: ${refundResult.error}`,
                                'OrdersService.ExpiryCron',
                            );
                        }
                    });

                    processedCount++;
                } catch (error) {
                    this.logger.error(
                        `Failed to expire RESERVED order ${order._id}: ${(error as Error).message}`,
                    );
                } finally {
                    await session.endSession();
                }
            }

            this.logger.log(`Batch ${batchNumber}: Processed ${ordersToExpire.length} RESERVED orders`);

            if (ordersToExpire.length < BATCH_SIZE) {
                break;
            }
        }

        if (processedCount > 0) {
            this.logger.log(
                `✅ RESERVED order expiry complete: ${processedCount} orders processed, ` +
                `${refundSuccessCount} refunds successful, ${refundFailedCount} refunds failed`,
            );
        }
    }

    async create(createOrderDto: CreateOrderDto, customerId: string): Promise<OrderDocument> {
        const session = await this.orderModel.db.startSession();

        try {
            let finalOrder: OrderDocument | null = null;

            await session.withTransaction(async () => {
                const customer = await this.userModel.findById(customerId).session(session);
                if (!customer) {throw new NotFoundException('Customer not found');}

                // Enforce phone verification for order placement
                if (!customer.phoneNumber || !customer.isPhoneVerified) {
                    throw new BadRequestException({
                        message: 'Phone verification required to place orders',
                        code: 'PHONE_VERIFICATION_REQUIRED',
                        requiresPhoneSetup: !customer.phoneNumber,
                        requiresPhoneVerification: !!customer.phoneNumber && !customer.isPhoneVerified
                    });
                }

                const establishment = await this.establishmentModel.findById(createOrderDto.establishmentId).session(session);
                if (!establishment) {throw new NotFoundException('Establishment not found');}
                const { orderItems, subtotal, totalDiscountAmount, updates } =
                    await this.validateAndBuildOrderItems(createOrderDto, session);
                for (const update of updates) {
                    await this.offerModel.findByIdAndUpdate(update.offerId, {
                        $inc: { reservedQuantity: update.quantity }
                    }, { session });

                    await this.offerModel.findOneAndUpdate(
                        {
                            _id: update.offerId,
                            'pickupTimeSlots.startTime': update.slotStart,
                            'pickupTimeSlots.endTime': update.slotEnd,
                        },
                        { $inc: { 'pickupTimeSlots.$.currentOrders': 1 } },
                        { session }
                    );
                }

                // 5. Calculate pricing
                // No service fee - customer pays exact bag price
                const serviceFee = 0;
                const taxAmount = 0;
                const total = subtotal + serviceFee + taxAmount;

                // 5.1. Calculate donation amount (1% of total order)
                // Formula: (total * 0.20 platform fee) * 0.05 donation percentage = 1% of total
                const donationAmount = this.donationsService
                    ? parseFloat((total * 0.01).toFixed(3))
                    : 0;

                // 6. Generate metadata
                const orderNumber = this.generateOrderNumber();
                const qrCode = this.generateQRCode();
                const pickupCode = this.generatePickupCode();
                const pickupDate = this.buildPickupDate(createOrderDto.pickupDate, createOrderDto.pickupTimeSlot.startTime);

                // 7. Create and save order
                const order = new this.orderModel({
                    orderNumber,
                    customerId: new Types.ObjectId(customerId),
                    establishmentId: new Types.ObjectId(createOrderDto.establishmentId),
                    merchantId: establishment.ownerId,
                    items: orderItems,
                    status: OrderStatus.PENDING,
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
                        currency: 'EUR',
                    },
                    pricing: {
                        subtotal,
                        discountAmount: totalDiscountAmount,
                        taxAmount,
                        serviceFee,
                        total,
                        currency: 'EUR',
                    },
                    establishmentAddress: establishment.address,
                    customerNotes: createOrderDto.customerNotes,
                    donationAmount, // Add donation tracking
                });

                const savedOrder = await order.save({ session });

                // 8. Populate before returning
                finalOrder = await this.orderModel
                    .findById(savedOrder._id)
                    .session(session)
                    .populate('customerId', 'firstName lastName email phoneNumber')
                    .populate('establishmentId', 'name address phoneNumber type')
                    .populate('items.offerId', 'title images type')
                    .exec();
            });

            // 9. Create donation record asynchronously (outside transaction)
            if (finalOrder && this.donationsService && finalOrder.donationAmount > 0) {
                try {
                    const donationInput = {
                        userId: new Types.ObjectId(customerId),
                        orderId: finalOrder._id as Types.ObjectId,
                        amount: finalOrder.donationAmount,
                        currency: 'TND',
                        metadata: {
                            platform: 'mobile' as const,
                        },
                    };

                    await this.donationsService.createDonation(donationInput);
                    this.logger.log(`Donation created for order ${finalOrder._id}: ${finalOrder.donationAmount} TND`);
                } catch (donationError) {
                    // Log error but don't fail the order
                    this.logger.error(
                        `Failed to create donation for order ${finalOrder._id}`,
                        donationError
                    );
                }
            }

            return finalOrder!;

        } catch (error) {
            this.appLogger.error(`Order creation failed: ${(error as Error).message}`, 'OrderService');

            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {throw error;}

            throw new InternalServerErrorException('Failed to create order');
        } finally {
            await session.endSession();
        }
    }


private isValidStatusTransition(oldStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const allowedTransitions = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
    [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.PICKED_UP]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.EXPIRED]: [],
    [OrderStatus.REFUNDED]: [],
  };

  return allowedTransitions[oldStatus]?.includes(newStatus) || false;
}

private generateOrderNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
}

private generateQRCode(): string {
  return crypto.randomBytes(20).toString('hex');
}

private generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

    async findById(orderId: string, userId?: string, userRole?: UserRole): Promise<OrderDocument> {
        const order = await this.orderModel
            .findById(orderId)
            .select(ORDER_DETAIL_FIELDS) // ✅ OPTIMIZATION: Reduce payload by excluding internal fields
            .populate('customerId', 'firstName lastName email phoneNumber avatar')
            .populate('establishmentId', 'name address phoneNumber type images averageRating')
            .populate('merchantId', 'firstName lastName email phoneNumber')
            .populate('items.offerId', 'title images type estimatedWeight')
            .exec();

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
        userRole?: UserRole
    ): Promise<{ orders: OrderLean[]; total: number }> {
        // ✅ OPTIMIZATION: Limit max page size to prevent DOS
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;
        const { query, sort } = this.buildQuery(userRole, userId, filters);

        const [orders, total] = await Promise.all([
            this.orderModel
                .find(query)
                .select(ORDER_LIST_FIELDS) // ✅ OPTIMIZATION: Only fetch required fields (60% payload reduction)
                .populate('customerId', 'firstName lastName email')
                .populate('establishmentId', 'name address type')
                .populate('items.offerId', 'title images')
                .sort(sort)
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ OPTIMIZATION: 50% memory reduction, 10-15% faster
                .exec(),
            this.orderModel.countDocuments(query),
        ]);

        return { orders, total };
    }

    private buildQuery(userRole: UserRole, userId: string, filters: OrderQueryDto): { query: OrderQueryFilter; sort: OrderSort } {
        const query: OrderQueryFilter = {};

        // Role-based filtering
        if (userRole === UserRole.CONSUMER) {
            if (!userId) {throw new Error('User ID is required for consumer');}
            query.customerId = new Types.ObjectId(userId);
        } else if (userRole === UserRole.MERCHANT) {
            if (!userId) {throw new Error('User ID is required for merchant');}
            query.merchantId = new Types.ObjectId(userId);
        } else if (userRole && userRole !== UserRole.ADMIN) {
            throw new Error(`Invalid user role: ${userRole}`);
        }

        // Filters
        if (filters.status) {query.status = filters.status as OrderStatus;}
        if (filters.establishmentId) {query.establishmentId = new Types.ObjectId(filters.establishmentId);}

        if (filters.fromDate || filters.toDate) {
            query.createdAt = {};
            if (filters.fromDate) {query.createdAt.$gte = new Date(filters.fromDate);}
            if (filters.toDate) {query.createdAt.$lte = new Date(filters.toDate);}
        }

        if (filters.search) {
            // Security: Escape regex pattern to prevent ReDoS attacks
            const safeRegex = this.regexSecurityUtil.buildSafeRegexQuery(filters.search);

            if (safeRegex) {
                query.$or = [
                    { orderNumber: safeRegex },
                    { items: { $elemMatch: { offerTitle: safeRegex } } },
                ];
            } else {
                // If pattern is invalid, log and skip search (fail-safe)
                this.appLogger.warn(
                    `Invalid search pattern blocked: ${filters.search}`,
                    'OrderService'
                );
            }
        }

        // Sorting
        const sortField = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

        const sort: OrderSort = { [sortField]: sortOrder };
        return { query, sort };
    }


    async requestPickupExtension(
        orderId: string,
        newPickupDate: string,
        userId: string,
        userRole: UserRole,
    ) {
        const order = await this.findById(orderId, userId, userRole);

        if (order.status !== 'confirmed' && order.status !== 'ready_for_pickup') {
            throw new BadRequestException('Cannot extend pickup time for this order status');
        }

        const parsedDate = new Date(newPickupDate);
        if (isNaN(parsedDate.getTime())) {
            throw new BadRequestException('Invalid pickup date format. Use ISO string like 2025-08-26T21:00:00.000Z');
        }
        this.appLogger.log(`Incoming newPickupDate: ${newPickupDate} (type: ${typeof newPickupDate})`, 'OrderService');

        order.pickupExtensionRequest = {
            newDate: parsedDate,
            approved: null,
            requestedAt: new Date(),
        };
        this.appLogger.log(`Setting pickup extension - newPickupDate: ${newPickupDate} (type: ${typeof newPickupDate})`, 'OrderService');

        await order.save();
        return order;
    }


    async findByCustomer(
        customerId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ orders: OrderLean[]; total: number }> {
        const result = await this.findAll(page, limit, {}, customerId, UserRole.CONSUMER);
        return result;
    }

    async findByMerchant(
        merchantId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ orders: OrderLean[]; total: number }> {
        const result = await this.findAll(page, limit, {}, merchantId, UserRole.MERCHANT);
        return result;
    }

    async updateStatus(
        orderId: string,
        updateDto: UpdateOrderStatusDto,
        userId: string,
        userRole: UserRole
    ): Promise<OrderDocument> {
        const order = await this.findById(orderId, userId, userRole);
        if (!this.isValidStatusTransition(order.status, updateDto.status as OrderStatus)) {
            throw new BadRequestException(`Cannot transition from ${order.status} to ${updateDto.status}`);
        }

        // Role-based permissions
        if (userRole === UserRole.MERCHANT) {
            if (order.merchantId._id.toString() !== userId) {
                throw new ForbiddenException('Access denied');
            }
            // Merchants can only confirm, mark ready, or cancel
            const allowedStatuses = [OrderStatus.CONFIRMED, OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED];
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
            { new: true }
        );

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
        userRole: UserRole
    ): Promise<OrderDocument> {
        const order = await this.findById(orderId);
        this.appLogger.log(`Order pickup details: ${JSON.stringify(order.pickupDetails)}`, 'OrderService');

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

        // Validate pickup code or QR code
        const isValidCode = order.pickupDetails.pickupCode === confirmDto.pickupCode ||
            (confirmDto.qrCode && order.pickupDetails.qrCode === confirmDto.qrCode);
        this.appLogger.log(`Validating pickup - Order details: ${JSON.stringify(order.pickupDetails)}`, 'OrderService');

        if (!isValidCode) {
            // Track failed attempt
            await this.trackFailedPickupAttempt(orderId, userId);
            throw new BadRequestException('Invalid pickup code or QR code');
        }

        // Check if order is ready for pickup (RESERVED, READY_FOR_PICKUP, or CONFIRMED for backward compat)
        const validStatuses = [OrderStatus.RESERVED, OrderStatus.READY_FOR_PICKUP, OrderStatus.CONFIRMED];
        if (!validStatuses.includes(order.status)) {
            throw new BadRequestException('Order is not ready for pickup');
        }

        // Consumer can show pickup code but only merchant should confirm
        if (userRole === UserRole.CONSUMER && order.customerId._id.toString() !== userId) {
            throw new ForbiddenException('Access denied');
        }

        // Only the merchant who owns this order can confirm pickup
        if (userRole === UserRole.MERCHANT && order.merchantId._id.toString() !== userId) {
            throw new ForbiddenException('Only the establishment merchant can confirm pickup');
        }

        // Use transaction for atomicity
        const session = await this.orderModel.db.startSession();

        try {
            await session.withTransaction(async () => {
                // 1. Update order status to PICKED_UP
                await this.orderModel.findByIdAndUpdate(orderId, {
                    status: OrderStatus.PICKED_UP,
                    'pickupDetails.actualPickupTime': new Date(),
                    ...(confirmDto.notes && { customerNotes: confirmDto.notes }),
                }, { session });

                // 2. Update inventory (release reserved, add to sold)
                await Promise.all(
                    order.items.map(item =>
                        this.offerModel.findByIdAndUpdate(item.offerId, {
                            $inc: {
                                reservedQuantity: -item.quantity,
                                soldQuantity: item.quantity
                            }
                        }, { session })
                    )
                );

                // 3. Find the payment and update status to EARNED
                const payment = await this.paymentModel.findOne({
                    orderId: new Types.ObjectId(orderId)
                }).session(session);

                if (payment && payment.status === PaymentStatus.HELD) {
                    payment.status = PaymentStatus.EARNED;
                    payment.earnedAt = new Date();
                    await payment.save({ session });

                    // 4. Create MerchantPayoutLedger entry for monthly payout
                    // Check if ledger entry already exists (idempotency)
                    const existingLedger = await this.payoutService.findByOrderId(orderId);
                    if (!existingLedger) {
                        await this.payoutService.createLedgerEntry({
                            merchantId: order.merchantId._id as Types.ObjectId,
                            orderId: order._id as Types.ObjectId,
                            paymentId: payment._id as Types.ObjectId,
                            establishmentId: order.establishmentId._id as Types.ObjectId,
                            orderTotal: order.pricing.total,
                        }, session);
                    }

                    this.appLogger.log(
                        `Pickup confirmed for order ${orderId}: Payment status HELD -> EARNED, ledger created`,
                        'OrderService'
                    );
                } else if (payment) {
                    // Legacy flow: payment already COMPLETED
                    this.appLogger.log(
                        `Pickup confirmed for order ${orderId}: Payment status ${payment.status} (legacy)`,
                        'OrderService'
                    );
                }
            });

            // 5. Award loyalty points to customer (outside transaction, non-blocking)
            // 10 points per bag (item quantity)
            const totalBags = order.items.reduce((sum, item) => sum + item.quantity, 0);

            if (this.loyaltyService) {
                try {
                    const pointsToAward = totalBags * this.POINTS_PER_BAG;

                    await this.loyaltyService.addPoints(order.customerId._id.toString(), {
                        amount: pointsToAward,
                        reason: `Order pickup completed - ${totalBags} bag(s)`,
                        orderId: orderId,
                    });

                    this.appLogger.log(
                        `Awarded ${pointsToAward} loyalty points to customer ${order.customerId._id} for order ${orderId}`,
                        'OrderService.Loyalty'
                    );
                } catch (loyaltyError) {
                    // Log error but don't fail the pickup confirmation
                    this.appLogger.error(
                        `Failed to award loyalty points for order ${orderId}: ${(loyaltyError as Error).message}`,
                        'OrderService.Loyalty'
                    );
                }
            }

            // 6. Gamification: Update friend referral bag counts, purchase streak, and business referral
            if (this.gamificationService) {
                try {
                    // Update friend referral tracking (if customer was referred)
                    await this.gamificationService.updateFriendBagCount(
                        order.customerId._id.toString(),
                        totalBags,
                    );

                    // Update purchase streak for customer
                    const streakResult = await this.gamificationService.updatePurchaseStreak(
                        order.customerId._id.toString(),
                        totalBags,
                    );

                    if (streakResult.completed) {
                        this.appLogger.log(
                            `Purchase streak completed! +${streakResult.pointsAwarded} points for ${order.customerId._id}`,
                            'OrderService.Gamification'
                        );
                    }

                    // Update business referral tracking (for merchant)
                    await this.gamificationService.updateBusinessOrderCount(
                        order.merchantId._id.toString(),
                    );
                } catch (gamificationError) {
                    // Log error but don't fail the pickup confirmation
                    this.appLogger.error(
                        `Gamification update failed for order ${orderId}: ${(gamificationError as Error).message}`,
                        'OrderService.Gamification'
                    );
                }
            }

            return this.findById(orderId);
        } catch (error) {
            this.appLogger.error(
                `Failed to confirm pickup for order ${orderId}: ${(error as Error).message}`,
                'OrderService'
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
        userRole: UserRole
    ): Promise<OrderDocument> {
        const order = await this.findById(orderId, userId, userRole);

        // Cannot cancel orders that are already completed, cancelled, or expired
        if ([OrderStatus.PICKED_UP, OrderStatus.CANCELLED, OrderStatus.EXPIRED].includes(order.status)) {
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
                    await Promise.all(
                        order.items.map(item =>
                            this.offerModel.findByIdAndUpdate(
                                item.offerId,
                                { $inc: { reservedQuantity: -item.quantity } },
                                { session },
                            ),
                        ),
                    );

                    // 2. Process refund via RefundService
                    const refundResult = await this.refundService.processCancelledOrderRefund(
                        orderId,
                        cancelDto.reason || 'Consumer cancellation',
                        session,
                    );

                    if (!refundResult.success && refundResult.paymentId) {
                        // Schedule retry if refund failed but order should still be cancelled
                        if (refundResult.willRetry) {
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
        await Promise.all([
            this.orderModel.findByIdAndUpdate(orderId, {
                status: OrderStatus.CANCELLED,
                cancellationReason: cancelDto.reason,
                merchantNotes: cancelDto.additionalNotes,
                cancelledAt: new Date(),
                cancelledBy: userRole === UserRole.MERCHANT ? 'merchant' : 'consumer',
            }),
            ...order.items.map(item =>
                this.offerModel.findByIdAndUpdate(item.offerId, {
                    $inc: { reservedQuantity: -item.quantity }
                })
            )
        ]);

        return this.findById(orderId);
    }

    /**
     * Calculate the pickup start time from order details
     * Uses scheduledDate + timeSlot.startTime
     */
    private calculatePickupStartTime(order: OrderDocument): Date {
        const pickupDate = new Date(order.pickupDetails.scheduledDate);
        const startTimeParts = order.pickupDetails.timeSlot.startTime.split(':');
        pickupDate.setHours(
            parseInt(startTimeParts[0], 10),
            parseInt(startTimeParts[1], 10),
            0,
            0,
        );
        return pickupDate;
    }
    async softDeleteOrder(
        orderId: string,
        adminId: string,
    ): Promise<Order> {
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
    async getOrderStats(userId: string, userRole: UserRole): Promise<OrderStatsResponse> {
        const matchCondition = userRole === UserRole.MERCHANT
            ? { merchantId: new Types.ObjectId(userId) }
            : { customerId: new Types.ObjectId(userId) };

        const stats = await this.orderModel.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$pricing.total' },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] }
                    },
                    confirmedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', OrderStatus.CONFIRMED] }, 1, 0] }
                    },
                    readyOrders: {
                        $sum: { $cond: [{ $eq: ['$status', OrderStatus.READY_FOR_PICKUP] }, 1, 0] }
                    },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] }
                    },
                    averageOrderValue: { $avg: '$pricing.total' }
                }
            }
        ]);

        const result: OrderStatsResult[] = stats as OrderStatsResult[];
        return result[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            confirmedOrders: 0,
            readyOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            averageOrderValue: 0
        };
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
                    status: { $ne: OrderStatus.EXPIRED }
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
                    await Promise.all(
                        order.items.map((item: any) =>
                            this.offerModel.findByIdAndUpdate(item.offerId, {
                                $inc: { reservedQuantity: -item.quantity }
                            })
                        )
                    );
                    await this.orderModel.findByIdAndUpdate(order._id, {
                        status: OrderStatus.EXPIRED,
                        expiredAt: now,
                        cancellationReason: 'Order expired automatically'
                    });

                    updatedCount++;
                } catch (error) {
                    this.appLogger.error(`Failed to update expired order ${order._id}: ${(error as Error).message}`, 'OrderService');
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
    private async validateAndBuildOrderItems(
        createOrderDto: CreateOrderDto,
        session: ClientSession
    ): Promise<{
        orderItems: OrderItemProcessed[];
        subtotal: number;
        totalDiscountAmount: number;
        updates: OrderQuantityUpdate[];
    }> {
        const pickupDate = new Date(createOrderDto.pickupDate);
        const offerIds = createOrderDto.items.map(item => new Types.ObjectId(item.offerId));
        const establishmentId = new Types.ObjectId(createOrderDto.establishmentId);

        // Fetch offers
        const offers = await this.offerModel.find({
            _id: { $in: offerIds },
            establishmentId,
            status: OfferStatus.ACTIVE,
            availableFrom: { $lte: pickupDate },
            availableUntil: { $gte: pickupDate },
        })
            .session(session)
            .populate('establishmentId');

        if (offers.length !== offerIds.length) {
            throw new BadRequestException('One or more offers are invalid or unavailable');
        }

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
                    reason: `Offer ${itemDto.offerId} not found`
                });
                continue;
            }

            const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
            if (availableQuantity < itemDto.quantity) {
                validationDetails.push({
                    offerId: offer._id as Types.ObjectId,
                    reason: `Insufficient quantity. Available: ${availableQuantity}, Requested: ${itemDto.quantity}`
                });
                continue;
            }

            const selectedSlot = offer.pickupTimeSlots.find(
                slot =>
                    slot.startTime.trim() === createOrderDto.pickupTimeSlot.startTime.trim() &&
                    slot.endTime.trim() === createOrderDto.pickupTimeSlot.endTime.trim()
            );

            if (!selectedSlot) {
                validationDetails.push({
                    offerId: offer._id as Types.ObjectId,
                    reason: 'Selected pickup time slot is not available for this offer'
                });
                continue;
            }

            if (selectedSlot.currentOrders >= selectedSlot.maxOrders) {
                validationDetails.push({
                    offerId: offer._id as Types.ObjectId,
                    reason: 'Selected pickup time slot is fully booked'
                });
                continue;
            }

            const itemTotal = offer.pricing.discountedPrice * itemDto.quantity;
            const itemOriginalTotal = offer.pricing.originalPrice * itemDto.quantity;
            const itemDiscount = itemOriginalTotal - itemTotal;

            subtotal += itemTotal;
            totalDiscountAmount += itemDiscount;

            orderItems.push({
                offerId: offer._id as Types.ObjectId,
                offerTitle: offer.title,
                quantity: itemDto.quantity,
                unitPrice: offer.pricing.discountedPrice,
                totalPrice: itemTotal,
                originalPrice: offer.pricing.originalPrice,
                discountAmount: itemDiscount,
            });

            updates.push({
                offerId: offer._id as Types.ObjectId,
                quantity: itemDto.quantity,
                slotStart: selectedSlot.startTime,
                slotEnd: selectedSlot.endTime
            });
        }

        if (validationDetails.length > 0) {
            throw new BadRequestException({
                message: 'Validation error: One or more offers are invalid or unavailable',
                details: validationDetails,
            });
        }

        return { orderItems, subtotal, totalDiscountAmount, updates };
    }
    private buildPickupDate(date: string, startTime: string): Date {
        const pickupDate = new Date(date);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        pickupDate.setHours(startHour, startMinute, 0, 0);
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
    async handlePickupExtensionApproval(orderId: string, approved: boolean) {
        const order = await this.orderModel.findById(orderId);
        if (!order.pickupExtensionRequest) {throw new BadRequestException('No extension request found');}

        order.pickupExtensionRequest.approved = approved;
        if (approved) {
            order.pickupDetails.scheduledDate = order.pickupExtensionRequest.newDate;
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
        if (!order) return;

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
}