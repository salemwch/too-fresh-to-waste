import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Currency, PaymentMethod } from '../schemas/payment.schema';

export class CardDetailsDto {
    @IsNotEmpty()
    @IsString()
    cardNumber: string;

    @IsNotEmpty()
    @IsString()
    expiryMonth: string;

    @IsNotEmpty()
    @IsString()
    expiryYear: string;

    @IsNotEmpty()
    @IsString()
    cvv: string;

    @IsOptional()
    @IsString()
    cardholderName?: string;
}

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsString()
    orderId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0.1)
    @Max(10000)
    amount: number;

    @IsEnum(Currency)
    @IsOptional()
    currency?: Currency = Currency.TND;

    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @ValidateNested()
    @Type(() => CardDetailsDto)
    cardDetails: CardDetailsDto;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    returnUrl?: string;

    @IsOptional()
    @IsString()
    cancelUrl?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, string | number | boolean>;
}