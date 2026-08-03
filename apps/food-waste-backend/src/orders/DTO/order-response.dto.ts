import { Expose, Type } from 'class-transformer';

import type {
  OrderItemResponse,
  PricingResponse,
  PaymentDetailsResponse,
  PopulatedUserResponse,
  PopulatedEstablishmentResponse,
} from '@foodwaste/shared';

// ---------------------------------------------------------------------------
// Sub-document DTOs — every @Expose() field is included; absent fields are
// stripped by plainToInstance({ excludeExtraneousValues: true }).
// ---------------------------------------------------------------------------

class OrderItemResponseDto implements OrderItemResponse {
  @Expose() offerId!: string;
  @Expose() offerTitle!: string;
  @Expose() quantity!: number;
  @Expose() unitPrice!: number;
  @Expose() totalPrice!: number;
  @Expose() originalPrice!: number;
  @Expose() discountAmount!: number;
}

class PricingResponseDto implements PricingResponse {
  @Expose() subtotal!: number;
  @Expose() discountAmount!: number;
  @Expose() taxAmount!: number;
  @Expose() deliveryFee!: number;
  @Expose() total!: number;
  @Expose() currency!: string;
}

class PaymentDetailsResponseDto implements PaymentDetailsResponse {
  @Expose() method!: string;
  @Expose() amount!: number;
  @Expose() currency!: string;
}

class EstablishmentAddressResponseDto {
  @Expose() street!: string;
  @Expose() city!: string;
  @Expose() postalCode!: string;
  @Expose() country!: string;
}

class PopulatedUserResponseDto implements PopulatedUserResponse {
  @Expose() _id!: string;
  @Expose() firstName!: string;
  @Expose() lastName!: string;
  @Expose() email!: string;
  @Expose() phoneNumber?: string | undefined;
  @Expose() avatar?: string | undefined;
}

class PopulatedEstablishmentResponseDto implements PopulatedEstablishmentResponse {
  @Expose() _id!: string;
  @Expose() name!: string;
  @Expose() address?: Record<string, unknown> | undefined;
  @Expose() phoneNumber?: string | undefined;
  @Expose() type!: string;
  @Expose() images?: string[] | undefined;
  @Expose() averageRating?: number | undefined;
}

// ---------------------------------------------------------------------------
// Pickup-details DTOs — the ONLY structural difference between consumer and
// merchant is the presence of pickupCode.
// ---------------------------------------------------------------------------

class ConsumerPickupDetailsDto {
  @Expose() timeSlot!: { startTime: string; endTime: string };
  @Expose() scheduledDate!: string;
  @Expose() actualPickupTime!: string;
  @Expose() qrCode!: string;
  @Expose() instructions!: string;
  // pickupCode is deliberately absent — stripped by excludeExtraneousValues
}

class MerchantPickupDetailsDto extends ConsumerPickupDetailsDto {
  @Expose() pickupCode!: string;
}

// ---------------------------------------------------------------------------
// Top-level order response DTOs
// ---------------------------------------------------------------------------

export class ConsumerOrderResponseDto {
  @Expose() _id!: string;
  @Expose() orderNumber!: string;
  @Expose() status!: string;
  @Expose() paymentStatus!: string;

  @Expose()
  @Type(() => PopulatedUserResponseDto)
  customerId!: PopulatedUserResponseDto;

  @Expose()
  @Type(() => PopulatedEstablishmentResponseDto)
  establishmentId!: PopulatedEstablishmentResponseDto;

  @Expose()
  @Type(() => PopulatedUserResponseDto)
  merchantId!: PopulatedUserResponseDto;

  @Expose()
  @Type(() => OrderItemResponseDto)
  items!: OrderItemResponseDto[];

  @Expose()
  @Type(() => ConsumerPickupDetailsDto)
  pickupDetails!: ConsumerPickupDetailsDto;

  @Expose()
  @Type(() => PaymentDetailsResponseDto)
  paymentDetails!: PaymentDetailsResponseDto;

  @Expose()
  @Type(() => PricingResponseDto)
  pricing!: PricingResponseDto;

  @Expose()
  @Type(() => EstablishmentAddressResponseDto)
  establishmentAddress!: EstablishmentAddressResponseDto;

  @Expose() customerNotes!: string;
  @Expose() merchantNotes!: string;
  @Expose() cancellationReason!: string;
  @Expose() donationAmount!: number;
  @Expose() expiresAt!: string;
  @Expose() isRated!: boolean;
  @Expose() createdAt!: string;
  @Expose() updatedAt!: string;

  @Expose() paymentProvider!: string;
  @Expose() paymentExpiresAt!: string;
  @Expose() paymentSession!: {
    provider: string;
    reference: string;
    payUrl: string;
    expiresAt: string;
  };
  @Expose() completedAt!: string;
  @Expose() pendingPaymentAt!: string;
  @Expose() deliveryMode!: string;
  @Expose() payUrl?: string;
}

export class MerchantOrderResponseDto extends ConsumerOrderResponseDto {
  // Override pickupDetails type to include the code
  @Expose()
  @Type(() => MerchantPickupDetailsDto)
  declare pickupDetails: MerchantPickupDetailsDto;
}
