import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import {
    IsOptional,
    IsString,
    IsEnum,
    IsDateString,
    IsNumber,
    Min,
    Max,
    IsBoolean,
    IsArray,
    Length,
} from 'class-validator';

export class UpdateOrderDto extends PartialType(CreateOrderDto) { }

export class OrderFiltersDto {
    @IsOptional()
    @IsString()
    @IsEnum(['pending', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired', 'refunded'])
    status?: string;

    @IsOptional()
    @IsString()
    @IsEnum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])
    paymentStatus?: string;

    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;

    @IsOptional()
    @IsString()
    establishmentId?: string;

    @IsOptional()
    @IsString()
    customerId?: string;

    @IsOptional()
    @IsString()
    merchantId?: string;

    @IsOptional()
    @IsString()
    @Length(1, 100)
    search?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minAmount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxAmount?: number;

    @IsOptional()
    @IsString()
    @IsEnum(['createdAt', 'updatedAt', 'pricing.total', 'pickupDetails.scheduledDate'])
    sortBy?: string;

    @IsOptional()
    @IsString()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';

    @IsOptional()
    @IsBoolean()
    includeExpired?: boolean;
}

export class ExtendPickupTimeDto {
    @IsDateString()
    newPickupDate: string;

    @IsString()
    @Length(1, 500)
    reason: string;

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    customerMessage?: string;
}

export class MerchantOrderUpdateDto {
    @IsOptional()
    @IsString()
    @IsEnum(['confirmed', 'ready_for_pickup', 'cancelled'])
    status?: string;

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    merchantNotes?: string;

    @IsOptional()
    @IsString()
    @Length(0, 500)
    preparationTime?: string; // e.g., "15 minutes", "1 hour"

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    specialInstructions?: string;
}

export class AdminOrderUpdateDto {
    @IsOptional()
    @IsString()
    @IsEnum(['pending', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired', 'refunded'])
    status?: string;

    @IsOptional()
    @IsString()
    @IsEnum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])
    paymentStatus?: string;

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    adminNotes?: string;

    @IsOptional()
    @IsString()
    @Length(0, 500)
    reason?: string;

    @IsOptional()
    @IsBoolean()
    sendNotification?: boolean;
}

export class BulkOrderUpdateDto {
    @IsArray()
    @IsString({ each: true })
    orderIds: string[];

    @IsString()
    @IsEnum(['confirmed', 'ready_for_pickup', 'cancelled', 'expired'])
    status: string;

    @IsOptional()
    @IsString()
    @Length(0, 500)
    reason?: string;

    @IsOptional()
    @IsBoolean()
    sendNotifications?: boolean = true;
}

export class OrderAnalyticsDto {
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;

    @IsOptional()
    @IsString()
    @IsEnum(['day', 'week', 'month', 'year'])
    groupBy?: string;

    @IsOptional()
    @IsString()
    establishmentId?: string;

    @IsOptional()
    @IsString()
    @IsEnum(['revenue', 'count', 'avg_order_value', 'completion_rate'])
    metric?: string;
}

export class OrderNotificationDto {
    @IsString()
    @IsEnum(['sms', 'email', 'push'])
    type: string;

    @IsString()
    @Length(1, 1000)
    message: string;

    @IsOptional()
    @IsString()
    @Length(0, 200)
    title?: string;

    @IsOptional()
    @IsBoolean()
    urgent?: boolean = false;
}

export class OrderFeedbackDto {
    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    comment?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsBoolean()
    wouldRecommend?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    improvements?: string[];
}