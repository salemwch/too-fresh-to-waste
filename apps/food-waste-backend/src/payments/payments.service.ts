import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { AppLoggerService } from '../common/services/logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentMethod, PaymentStatus } from './schemas/payment.schema';
import { Order, OrderDocument, OrderStatus } from 'src/orders/schemas/order.schema';
import { User, UserDocument, UserRole } from 'src/users/schemas/user.schema';
import { SMTPaymentService } from './services/smt-payment.service';
import { PaymentWebhook, PaymentWebhookDocument, WebhookStatus } from './schemas/webhook.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessRefundDto } from './dto/proccess-refund.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { SMTWebhookPayloadDto } from './dto/webhook-payload.dto';
import { v4 as uuidv4 } from 'uuid';
import { toObjectId } from 'src/common/utils/mongo.utils';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        @InjectModel(Payment.name) readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(PaymentWebhook.name) readonly webhookModel: Model<PaymentWebhookDocument>,
        @InjectModel(Order.name) readonly orderModel: Model<OrderDocument>,
        @InjectModel(User.name) readonly userModel: Model<UserDocument>,
        private readonly smtPaymentService: SMTPaymentService,
        private readonly appLogger: AppLoggerService,
    ) { }

    async createPayment(createPaymentDto: CreatePaymentDto, customerId: string): Promise<PaymentDocument> {
        try {
            const order = await this.orderModel.findById(createPaymentDto.orderId);
            if (!order) {
                throw new NotFoundException('Order not found');
            }

            if (order.customerId.toString() !== customerId) {
                throw new ForbiddenException('Access denied');
            }

            if (order.status !== OrderStatus.PENDING) {
                throw new BadRequestException('Order is not in pending status');
            }
            const existingPayment = await this.paymentModel.findOne({
                orderId: createPaymentDto.orderId,
                status: { $in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.COMPLETED] }
            });

            if (existingPayment) {
                throw new ConflictException('Payment already exists for this order');
            }

            const merchantTransactionId = this.generateMerchantTransactionId();

            const cardType = this.smtPaymentService.getCardType(createPaymentDto.cardDetails.cardNumber);

            const payment = new this.paymentModel({
                transactionId: process.env.NODE_ENV === 'development'
                    ? `FAKE-${uuidv4()}`
                    : `TEMP-${uuidv4()}`,
                merchantTransactionId: process.env.NODE_ENV === 'development'
                    ? `MERCHANT-${uuidv4()}`
                    : merchantTransactionId,
                orderId: createPaymentDto.orderId,
                customerId: new Types.ObjectId(customerId),
                establishmentId: order.establishmentId,
                merchantId: order.merchantId,
                status: PaymentStatus.PENDING,
                paymentMethod: cardType,
                currency: createPaymentDto.currency,
                amount: createPaymentDto.amount,
                processingFee: this.calculateProcessingFee(createPaymentDto.amount, cardType),
                cardInfo: {
                    maskedCardNumber: this.smtPaymentService.maskCardNumber(createPaymentDto.cardDetails.cardNumber),
                    cardType: cardType,
                    expiryMonth: createPaymentDto.cardDetails.expiryMonth,
                    expiryYear: createPaymentDto.cardDetails.expiryYear,
                    cardholderName: createPaymentDto.cardDetails.cardholderName,
                },
                metadata: {
                    orderId: createPaymentDto.orderId,
                    establishmentId: order.establishmentId.toString(),
                    customerId: customerId,
                    merchantId: order.merchantId.toString(),
                    ...createPaymentDto.metadata,
                },
                description: createPaymentDto.description,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            });

            const savedPayment = await payment.save();

            // Process payment with SMT
            try {
                savedPayment.status = PaymentStatus.PROCESSING;
                await savedPayment.save();

                const smtResponse = await this.smtPaymentService.processPayment({
                    merchantTransactionId,
                    amount: createPaymentDto.amount,
                    currency: createPaymentDto.currency,
                    cardNumber: createPaymentDto.cardDetails.cardNumber,
                    expiryMonth: createPaymentDto.cardDetails.expiryMonth,
                    expiryYear: createPaymentDto.cardDetails.expiryYear,
                    cvv: createPaymentDto.cardDetails.cvv,
                    cardholderName: createPaymentDto.cardDetails.cardholderName,
                    description: createPaymentDto.description,
                    returnUrl: createPaymentDto.returnUrl,
                    cancelUrl: createPaymentDto.cancelUrl,
                    metadata: createPaymentDto.metadata,
                });

                savedPayment.status = this.mapSMTStatusToPaymentStatus(smtResponse.status);

                savedPayment.smtResponse = {
                    transactionId: smtResponse.transactionId || merchantTransactionId,
                    merchantTransactionId,
                    status: PaymentStatus.COMPLETED, // keep original SMT status for logging
                    responseCode: smtResponse.responseCode || '00',
                    responseMessage: smtResponse.responseMessage || ' Success',
                    authorizationCode: smtResponse.authorizationCode || null,
                    rrn: smtResponse.rrn || null,
                    timestamp: new Date(),
                };


                if (smtResponse.success) {
                    // TGTG Model: Money held in escrow until pickup confirmation
                    savedPayment.status = PaymentStatus.HELD;
                    // Update order status to RESERVED (money held, awaiting pickup)
                    await this.orderModel.findByIdAndUpdate(createPaymentDto.orderId, {
                        status: OrderStatus.RESERVED,
                        paymentStatus: 'held',
                    });
                } else {
                    savedPayment.status = PaymentStatus.FAILED;
                    savedPayment.failureReason = smtResponse.responseMessage;
                }

                await savedPayment.save();

                this.appLogger.log(`CreatePayment DTO: ${JSON.stringify(createPaymentDto)}`, 'PaymentsService');
                this.appLogger.log(`User ID: ${customerId}`, 'PaymentsService');
                this.appLogger.log(`savedPayment: ${JSON.stringify(savedPayment)}`, 'PaymentsService');

                return await this.findById(savedPayment._id.toString());
            } catch (smtError) {

                this.appLogger.error(`SMT payment processing failed: ${(smtError as Error).message}`, 'PaymentsService');
                savedPayment.status = PaymentStatus.FAILED;
                savedPayment.failureReason = 'Payment gateway error';
                await savedPayment.save();
                throw new BadRequestException('Payment processing failed');
            }

        } catch (error) {
            this.appLogger.error(`Payment creation error: ${(error as Error).message}`, 'PaymentsService');
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create payment');
        }
    }

    async processRefund(processRefundDto: ProcessRefundDto, adminId: string): Promise<PaymentDocument> {
        try {
            const payment = await this.findById(processRefundDto.transactionId);

            // Allow refunds for both HELD (escrow) and COMPLETED (legacy) payments
            if (payment.status !== PaymentStatus.COMPLETED && payment.status !== PaymentStatus.HELD) {
                throw new BadRequestException('Can only refund completed or held payments');
            }

            const refundableAmount = payment.amount - payment.refundedAmount;
            if (processRefundDto.amount > refundableAmount) {
                throw new BadRequestException(`Refund amount exceeds refundable amount: ${refundableAmount}`);
            }
            const merchantRefundId = this.generateMerchantTransactionId();

            const smtResponse = await this.smtPaymentService.processRefund({
                originalTransactionId: payment.transactionId,
                amount: processRefundDto.amount,
                reason: processRefundDto.reason,
                merchantRefundId,
            });

            if (smtResponse.success) {
                payment.refundedAmount += processRefundDto.amount;
                payment.refundReason = processRefundDto.reason;
                payment.refundedAt = new Date();

                // Update status based on refund amount
                if (payment.refundedAmount >= payment.amount) {
                    payment.status = PaymentStatus.REFUNDED;
                } else {
                    payment.status = PaymentStatus.PARTIALLY_REFUNDED;
                }

                // Add refund metadata
                payment.metadata = {
                    ...payment.metadata,
                    refundedBy: adminId,
                    refundReason: processRefundDto.reason,
                    adminNotes: processRefundDto.adminNotes,
                };

                await payment.save();

                // Update order status if fully refunded
                if (payment.status === PaymentStatus.REFUNDED) {
                    await this.orderModel.findByIdAndUpdate(payment.orderId, {
                        status: OrderStatus.REFUNDED,
                        paymentStatus: 'refunded',
                    });
                }

                return payment;
            } else {
                throw new BadRequestException(`Refund failed: ${smtResponse.responseMessage}`);
            }
        } catch (error) {
            this.appLogger.error(`Refund processing error: ${(error as Error).message}`, 'PaymentsService');
            throw error;
        }
    }
    async findAllCursor(
        limit: number = 10,
        after?: string,
        filters: PaymentQueryDto = {},
        userId?: string,
        userRole?: UserRole,
    ): Promise<{ payments: PaymentDocument[]; nextCursor?: string }> {
        if (limit > 10) {limit = 10;}

        const query: any = {};
        if (userRole === UserRole.MERCHANT && userId) {
            query.merchantId = toObjectId(userId);
        }
        if (filters.status) {query.status = filters.status;}
        if (filters.paymentMethod) {query.paymentMethod = filters.paymentMethod;}
        if (filters.customerId) {query.customerId = filters.customerId;}
        if (filters.merchantId) {query.merchantId = filters.merchantId;}
        if (filters.establishmentId) {query.establishmentId = filters.establishmentId;}

        // Date filter
        if (filters.fromDate || filters.toDate) {
            query.createdAt = {};
            if (filters.fromDate) {query.createdAt.$gte = new Date(filters.fromDate);}
            if (filters.toDate) {query.createdAt.$lte = new Date(filters.toDate);}
        }

        // Amount filter
        if (filters.minAmount || filters.maxAmount) {
            query.amount = {};
            if (filters.minAmount) {query.amount.$gte = filters.minAmount;}
            if (filters.maxAmount) {query.amount.$lte = filters.maxAmount;}
        }

        // Free-text search
        if (filters.search) {
            query.$or = [
                { transactionId: { $regex: filters.search, $options: 'i' } },
                { merchantTransactionId: { $regex: filters.search, $options: 'i' } },
                { 'smtResponse.rrn': { $regex: filters.search, $options: 'i' } },
            ];
        }

        // Cursor pagination
        if (after) {
            const afterDoc = await this.paymentModel.findById(after).lean<PaymentDocument>();
            if (afterDoc) {
                query.createdAt = { ...query.createdAt, $gt: afterDoc.createdAt };
            }
        }

        // Query DB
        const payments = await this.paymentModel
            .find(query)
            .sort({ createdAt: 1 })
            .limit(limit + 1)
            .populate('customerId', 'firstName lastName email')
            .populate('establishmentId', 'name type')
            .populate('merchantId', 'firstName lastName')
            .exec();

        let nextCursor: string | undefined;
        if (payments.length > limit) {
            const nextItem = payments.pop();
            nextCursor = nextItem._id.toString();
        }

        return { payments, nextCursor };
    }


    async findById(paymentId: string, userId?: string, userRole?: UserRole): Promise<PaymentDocument> {
        const payment = await this.paymentModel
            .findById(paymentId)
            .populate('customerId', 'firstName lastName email phoneNumber')
            .populate('establishmentId', 'name address type')
            .populate('merchantId', 'firstName lastName email')
            .populate('orderId')
            .exec();

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Access control
        if (userId && userRole !== UserRole.ADMIN) {
            const isCustomer = payment.customerId._id.toString() === userId;
            const isMerchant = payment.merchantId._id.toString() === userId;

            if (!isCustomer && !isMerchant) {
                throw new ForbiddenException('Access denied');
            }
        }

        return payment;
    }


    async handleWebhook(webhookPayload: SMTWebhookPayloadDto, signature: string, timestamp: string): Promise<void> {
        try {
            // Create webhook record
            const webhook = new this.webhookModel({
                webhookId: `wh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                transactionId: webhookPayload.transactionId,
                payload: webhookPayload,
                signature,
                status: WebhookStatus.PENDING,
            });

            const payloadString = JSON.stringify(webhookPayload);
            const isValid = this.smtPaymentService.verifyWebhookSignature(payloadString, signature, timestamp);

            webhook.isVerified = isValid;

            if (!isValid) {
                webhook.status = WebhookStatus.FAILED;
                webhook.processingError = 'Invalid signature';
                await webhook.save();
                this.appLogger.warn(`Invalid webhook signature for transaction: ${webhookPayload.transactionId}`, 'PaymentsService');
                return;
            }

            // Find payment by transaction ID
            const payment = await this.paymentModel.findOne({
                $or: [
                    { transactionId: webhookPayload.transactionId },
                    { merchantTransactionId: webhookPayload.merchantTransactionId }
                ]
            });

            if (!payment) {
                webhook.status = WebhookStatus.IGNORED;
                webhook.processingError = 'Payment not found';
                await webhook.save();
                this.appLogger.warn(`Payment not found for webhook: ${webhookPayload.transactionId}`, 'PaymentsService');
                return;
            }

            // Update payment status based on webhook
            const previousStatus = payment.status;
            const newStatus = this.mapSMTStatusToPaymentStatus(webhookPayload.status);

            if (newStatus && newStatus !== previousStatus) {
                payment.status = newStatus;
                payment.smtResponse = {
                    ...payment.smtResponse,
                    status: webhookPayload.status,
                    responseCode: webhookPayload.responseCode,
                    responseMessage: webhookPayload.responseMessage,
                    authorizationCode: webhookPayload.authorizationCode,
                    rrn: webhookPayload.rrn,
                    timestamp: new Date(webhookPayload.timestamp),
                };
                payment.webhookDeliveredAt = new Date();

                // Update order status if needed
                if (newStatus === PaymentStatus.COMPLETED && previousStatus !== PaymentStatus.COMPLETED) {
                    await this.orderModel.findByIdAndUpdate(payment.orderId, {
                        status: OrderStatus.CONFIRMED,
                        paymentStatus: 'paid',
                    });
                } else if (newStatus === PaymentStatus.FAILED && previousStatus === PaymentStatus.PROCESSING) {
                    payment.failureReason = webhookPayload.responseMessage;
                }

                await payment.save();
                this.appLogger.log(`Payment status updated via webhook: ${payment.transactionId} - ${previousStatus} -> ${newStatus}`, 'PaymentsService');
            }

            webhook.status = WebhookStatus.PROCESSED;
            webhook.processedAt = new Date();
            await webhook.save();

        } catch (error) {
            this.appLogger.error(`Webhook processing error: ${(error as Error).message}`, 'PaymentsService');

            // Update webhook with error
            try {
                await this.webhookModel.updateOne(
                    { transactionId: webhookPayload.transactionId },
                    {
                        status: WebhookStatus.FAILED,
                        processingError: (error as Error).message,
                        nextRetryAt: new Date(Date.now() + 60000), // Retry in 1 minute
                    }
                );
            } catch (updateError) {
                this.appLogger.error(`Failed to update webhook status: ${(updateError as Error).message}`, 'PaymentsService');
            }
        }
    }

    async getPaymentStats(userId: string, userRole: UserRole): Promise<any> {
        // Define match conditions based on role
        let matchCondition: any = {};

        switch (userRole) {
            case UserRole.CONSUMER:
                matchCondition.customerId = new Types.ObjectId(userId);
                break;
            case UserRole.MERCHANT:
                matchCondition.merchantId = new Types.ObjectId(userId);
                break;
            case UserRole.ADMIN:
                // Admin sees all payments
                matchCondition = {};
                break;
            default:
                throw new ForbiddenException('Role not allowed to view stats');
        }

        // Aggregate overview stats
        const overviewStats = await this.paymentModel.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    totalRefunded: { $sum: '$refundedAmount' },
                    completedPayments: {
                        $sum: { $cond: [{ $eq: ['$status', PaymentStatus.COMPLETED] }, 1, 0] }
                    },
                    failedPayments: {
                        $sum: { $cond: [{ $eq: ['$status', PaymentStatus.FAILED] }, 1, 0] }
                    },
                    pendingPayments: {
                        $sum: { $cond: [{ $eq: ['$status', PaymentStatus.PENDING] }, 1, 0] }
                    },
                    refundedPayments: {
                        $sum: { $cond: [{ $eq: ['$status', PaymentStatus.REFUNDED] }, 1, 0] }
                    },
                    averageAmount: { $avg: '$amount' },
                    totalProcessingFees: { $sum: '$processingFee' },
                }
            }
        ]);

        // Aggregate payment method breakdown
        const paymentMethodStats = await this.paymentModel.aggregate([
            { $match: matchCondition },
            { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } }
        ]);

        return {
            overview: overviewStats[0] || {
                totalPayments: 0,
                totalAmount: 0,
                totalRefunded: 0,
                completedPayments: 0,
                failedPayments: 0,
                pendingPayments: 0,
                refundedPayments: 0,
                averageAmount: 0,
                totalProcessingFees: 0,
            },
            paymentMethods: paymentMethodStats,
        };
    }


    async retryFailedWebhooks(): Promise<number> {
        const failedWebhooks = await this.webhookModel.find({
            status: WebhookStatus.FAILED,
            retryCount: { $lt: 3 },
            nextRetryAt: { $lte: new Date() },
        }).limit(10);

        let retriedCount = 0;

        for (const webhook of failedWebhooks) {
            try {
                await this.handleWebhook(
                    webhook.payload as unknown as SMTWebhookPayloadDto,
                    webhook.signature,
                    new Date().toISOString()
                );

                webhook.retryCount += 1;
                await webhook.save();
                retriedCount++;
            } catch (err) {
                this.appLogger.error(`Webhook retry failed for ${webhook._id}: ${(err as Error).message}`, 'PaymentsService');
                webhook.retryCount += 1;
                webhook.nextRetryAt = new Date(Date.now() + Math.pow(2, webhook.retryCount) * 60000); // Exponential backoff
                await webhook.save();
            }
        }

        return retriedCount;
    }

    private generateMerchantTransactionId(): string {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `TXN_${timestamp}_${random}`;
    }

    private calculateProcessingFee(amount: number, paymentMethod: PaymentMethod): number {
        // Processing fee calculation based on payment method
        const feeRates = {
            [PaymentMethod.VISA]: 0.029, // 2.9%
            [PaymentMethod.MASTERCARD]: 0.029, // 2.9%
            [PaymentMethod.EDAHABIA]: 0.015, // 1.5%
            [PaymentMethod.LOCAL_BANK_CARD]: 0.02, // 2%
            [PaymentMethod.MOBILE_PAYMENT]: 0.025, // 2.5%
        };

        const feeRate = feeRates[paymentMethod] || 0.03;
        const fee = amount * feeRate;
        const minFee = 0.5; // Minimum fee in TND
        const maxFee = 50; // Maximum fee in TND

        return Math.max(minFee, Math.min(fee, maxFee));
    }

    private mapSMTStatusToPaymentStatus(smtStatus: string): PaymentStatus | null {
        const statusMap: Record<string, PaymentStatus> = {
            'completed': PaymentStatus.COMPLETED,
            'success': PaymentStatus.COMPLETED,
            'paid': PaymentStatus.COMPLETED,
            'failed': PaymentStatus.FAILED,
            'error': PaymentStatus.FAILED,
            'declined': PaymentStatus.FAILED,
            'cancelled': PaymentStatus.CANCELLED,
            'pending': PaymentStatus.PENDING,
            'processing': PaymentStatus.PROCESSING,
            'refunded': PaymentStatus.REFUNDED,
            'disputed': PaymentStatus.DISPUTED,
        };

        return statusMap[smtStatus.toLowerCase()] || null;
    }
}