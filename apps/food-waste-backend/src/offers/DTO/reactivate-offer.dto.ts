import {
    IsDateString,
    IsOptional,
    IsBoolean,
    IsNumber,
    ValidateNested,
    ArrayMinSize,
    Min,
    Max,
    IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReactivatePickupTimeSlotDto {
    @IsString()
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value[0]?.trim?.() || value[0];
        return typeof value === 'string' ? value.trim() : value;
    })
    startTime: string;

    @IsString()
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value[0]?.trim?.() || value[0];
        return typeof value === 'string' ? value.trim() : value;
    })
    endTime: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => {
        if (typeof value === 'string') return parseInt(value, 10);
        return value;
    })
    maxOrders?: number;
}

export class ReactivateOfferDto {
    @IsDateString()
    @ApiProperty({
        description: 'New availability start date (ISO 8601)',
        example: '2026-02-11T08:00:00.000Z',
    })
    availableFrom: string;

    @IsDateString()
    @ApiProperty({
        description: 'New availability end date (ISO 8601)',
        example: '2026-02-11T20:00:00.000Z',
    })
    availableUntil: string;

    @ValidateNested({ each: true })
    @Type(() => ReactivatePickupTimeSlotDto)
    @ArrayMinSize(1)
    @ApiProperty({
        description: 'New pickup time slots',
        type: [ReactivatePickupTimeSlotDto],
    })
    pickupTimeSlots: ReactivatePickupTimeSlotDto[];

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1000)
    @Transform(({ value }) => {
        if (typeof value === 'string') return parseInt(value, 10);
        return value;
    })
    @ApiProperty({
        description: 'New total quantity (optional, keeps original if not provided)',
        example: 10,
        required: false,
    })
    totalQuantity?: number;

    @IsOptional()
    @IsString()
    @ApiProperty({
        description: 'IANA timezone (e.g., "Africa/Tunis")',
        example: 'Africa/Tunis',
        required: false,
        default: 'Africa/Tunis',
    })
    timezone?: string = 'Africa/Tunis';

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        description: 'True if the merchant scheduled this offer for today',
        required: false,
        default: false,
    })
    isPickupToday?: boolean = false;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        description: 'True if the merchant scheduled this offer for tomorrow',
        required: false,
        default: false,
    })
    isPickupTomorrow?: boolean = false;
}
