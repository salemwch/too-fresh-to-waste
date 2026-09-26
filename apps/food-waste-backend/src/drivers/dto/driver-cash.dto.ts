import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

/** Driver confirms, at the door, what the customer paid. */
export class MarkDeliveredDto {
  /**
   * Cash received from the customer, in TND. Send 0 for an online-paid order.
   * Optional only so an app version that predates it keeps working - such a
   * delivery is recorded as an unconfirmed collection and flagged.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000)
  collectedCash?: number;
}

export const DELIVERY_FAILURE_REASONS = [
  'CUSTOMER_REFUSED',
  'CUSTOMER_UNREACHABLE',
  'CUSTOMER_UNAVAILABLE',
  'MERCHANT_FAULT',
  'DRIVER_FAULT',
] as const;

export const DELIVERY_RECOVERIES = [
  'RECOVERABLE_PENDING',
  'RETURNED_TO_MERCHANT',
  'UNRECOVERABLE',
] as const;

export class FailDeliveryDto {
  @IsIn(DELIVERY_FAILURE_REASONS)
  reason!: (typeof DELIVERY_FAILURE_REASONS)[number];

  @IsIn(DELIVERY_RECOVERIES)
  recovery!: (typeof DELIVERY_RECOVERIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  notes?: string;
}

export class MoveFloatDto {
  @IsIn(['ISSUED', 'RETURNED'])
  type!: 'ISSUED' | 'RETURNED';

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  reason?: string;
}

export class RecordHandoverDto {
  /** > 0 the driver handed cash to TFTW; < 0 TFTW paid the driver. */
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @NotEquals(0)
  @Min(-100000)
  @Max(100000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  notes?: string;
}

export class ResolveRecoveryDto {
  @IsIn(['RETURNED_TO_MERCHANT', 'UNRECOVERABLE'])
  recovery!: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';
}

export class ReconciliationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsMongoId()
  driverId?: string;
}
