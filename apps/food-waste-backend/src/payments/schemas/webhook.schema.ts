import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

export enum WebhookStatus {
    PENDING = 'pending',
    PROCESSED = 'processed',
    FAILED = 'failed',
    IGNORED = 'ignored'
}

export interface StripeWebhookPayload {
    id: string;
    object: string;
    type: string;
    data: {
        object: {
            id: string;
            amount: number;
            currency: string;
            status: string;
            metadata?: Record<string, string>;
        };
    };
    created: number;
    livemode: boolean;
}

export type WebhookPayload = StripeWebhookPayload | Record<string, unknown>;

export interface PaymentWebhookDocument extends Document {
    webhookId: string;
    transactionId?: string;
    status: WebhookStatus;
    payload: WebhookPayload;
    signature: string;
    isVerified: boolean;
    processingError?: string;
    retryCount: number;
    processedAt?: Date;
    nextRetryAt?: Date;
}
@Schema({ timestamps: true })
export class PaymentWebhook {
    @Prop({ required: true })
    webhookId: string;

    @Prop({ required: false, default: null })
    transactionId: string;

    @Prop({ type: String, enum: WebhookStatus, default: WebhookStatus.PENDING })
    status: WebhookStatus;

    @Prop({ required: true, type: Object })
    payload: WebhookPayload;

    @Prop({ required: true })
    signature: string;

    @Prop({ default: false })
    isVerified: boolean;

    @Prop()
    processingError?: string;

    @Prop({ default: 0 })
    retryCount: number;

    @Prop()
    processedAt?: Date;

    @Prop()
    nextRetryAt?: Date;
}

export const PaymentWebhookSchema = SchemaFactory.createForClass(PaymentWebhook);

PaymentWebhookSchema.index({ webhookId: 1 }, { unique: true });
PaymentWebhookSchema.index({ transactionId: 1 });
PaymentWebhookSchema.index({ status: 1, nextRetryAt: 1 });