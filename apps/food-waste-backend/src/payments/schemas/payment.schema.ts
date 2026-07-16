import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  HELD = 'held',
  EARNED = 'earned', // Merchant entitled to payout after pickup confirmation
  COMPLETED = 'completed', // Legacy - kept for backward compatibility
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  EXPIRED = 'expired',
  DISPUTED = 'disputed',
}

export enum PaymentMethod {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  EDAHABIA = 'edahabia',
  LOCAL_BANK_CARD = 'local_bank_card',
  MOBILE_PAYMENT = 'mobile_payment',
}

export enum Currency {
  TND = 'TND',
  EUR = 'EUR',
  USD = 'USD',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  PARTIAL_REFUND = 'partial_refund',
  CHARGEBACK = 'chargeback',
  REVERSAL = 'reversal',
}

export interface PaymentMetadata {
  orderId?: string | undefined;
  establishmentId?: string | undefined;
  customerId?: string | undefined;
  merchantId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  deviceInfo?: string | undefined;
  riskScore?: number | undefined;
  fraudFlags?: string[] | undefined;
  refundedBy?: string | undefined;
  refundReason?: string | undefined;
  adminNotes?: string | undefined;
}

export interface CardInfo {
  maskedCardNumber: string;
  cardType: PaymentMethod;
  expiryMonth: string;
  expiryYear: string;
  cardholderName?: string;
  issuerBank?: string;
  country?: string;
  isDebitCard?: boolean;
}

export interface GatewayResponse {
  transactionId: string;
  merchantTransactionId: string;
  status: string;
  responseCode: string;
  responseMessage: string;
  authorizationCode?: string | undefined;
  rrn?: string | undefined;
  timestamp: Date;
  signature?: string | undefined;
  redirectUrl?: string | undefined;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: false, default: null })
  transactionId!: string;

  @Prop({ required: true })
  merchantTransactionId!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Order' })
  orderId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  customerId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  establishmentId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String, enum: Currency, default: Currency.TND })
  currency!: Currency;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: 0, min: 0 })
  refundedAmount!: number;

  @Prop({ default: 0, min: 0 })
  processingFee!: number;

  @Prop({ type: String, enum: TransactionType, default: TransactionType.PAYMENT })
  transactionType!: TransactionType;

  @Prop({
    type: {
      maskedCardNumber: { type: String, required: true },
      cardType: { type: String, enum: PaymentMethod, required: true },
      expiryMonth: { type: String, required: true },
      expiryYear: { type: String, required: true },
      cardholderName: String,
      issuerBank: String,
      country: String,
      isDebitCard: { type: Boolean, default: false },
    },
  })
  cardInfo?: CardInfo;

  @Prop({
    type: {
      transactionId: { type: String, required: false, default: null },
      merchantTransactionId: { type: String, required: true },
      status: { type: String, required: true },
      responseCode: { type: String, required: true },
      responseMessage: { type: String, required: true },
      authorizationCode: String,
      rrn: String,
      timestamp: { type: Date, required: true },
      signature: String,
    },
  })
  smtResponse!: GatewayResponse;

  @Prop({ type: Object })
  metadata?: PaymentMetadata;

  @Prop()
  description?: string;

  @Prop()
  failureReason?: string;

  @Prop()
  refundReason?: string;

  @Prop({ default: false })
  is3DSecureVerified!: boolean;

  @Prop({ default: false })
  isRecurring!: boolean;

  @Prop()
  recurringToken?: string;

  @Prop()
  webhookDeliveredAt?: Date;

  @Prop()
  settledAt?: Date;

  @Prop()
  earnedAt?: Date;

  @Prop()
  refundedAt?: Date;

  @Prop()
  disputedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: 0 })
  retryCount!: number;

  @Prop({ default: false })
  isTestTransaction!: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// ---------------------------------------------------------------------------
// Indexes — derived from actual query patterns in PaymentService
// ---------------------------------------------------------------------------

// Duplicate payment check: findOne({ orderId, status: {$in} })
PaymentSchema.index({ orderId: 1, status: 1 });

// Webhook lookup: findOne({ transactionId }) or findOne({ merchantTransactionId })
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ merchantTransactionId: 1 }, { unique: true });

// Merchant payment listing (cursor): find({ merchantId }).sort({ createdAt: 1 })
PaymentSchema.index({ merchantId: 1, createdAt: 1 });

// Customer payment listing (cursor): find({ customerId }).sort({ createdAt: 1 })
PaymentSchema.index({ customerId: 1, createdAt: 1 });

// Admin/stats aggregation: $match({ status }) in getPaymentStats
PaymentSchema.index({ status: 1 });
