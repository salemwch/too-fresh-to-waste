import { Expose, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Sub-document DTOs — every @Expose() field is included; absent fields are
// stripped by plainToInstance({ excludeExtraneousValues: true }).
// ---------------------------------------------------------------------------

export class OrderItemResponseDto {
  @Expose() offerId: string;
  @Expose() offerTitle: string;
  @Expose() quantity: number;
  @Expose() unitPrice: number;
  @Expose() totalPrice: number;
  @Expose() originalPrice: number;
  @Expose() discountAmount: number;
}

export class PricingResponseDto {
  @Expose() subtotal: number;
  @Expose() discountAmount: number;
  @Expose() taxAmount: number;
  @Expose() serviceFee: number;
  @Expose() total: number;
  @Expose() currency: string;
}

export class PaymentDetailsResponseDto {
  @Expose() method: string;
  @Expose() amount: number;
  @Expose() currency: string;
}

export class EstablishmentAddressResponseDto {
  @Expose() street: string;
  @Expose() city: string;
  @Expose() postalCode: string;
  @Expose() country: string;
}

export class PopulatedUserResponseDto {
  @Expose() _id: string;
  @Expose() firstName: string;
  @Expose() lastName: string;
  @Expose() email: string;
  @Expose() phoneNumber: string;
  @Expose() avatar: string;
}

export class PopulatedEstablishmentResponseDto {
  @Expose() _id: string;
  @Expose() name: string;
  @Expose() address: Record<string, unknown>;
  @Expose() phoneNumber: string;
  @Expose() type: string;
  @Expose() images: string[];
  @Expose() averageRating: number;
}

// ---------------------------------------------------------------------------
// Pickup-details DTOs — the ONLY structural difference between consumer and
// merchant is the presence of pickupCode.
// ---------------------------------------------------------------------------

export class ConsumerPickupDetailsDto {
  @Expose() timeSlot: { startTime: string; endTime: string };
  @Expose() scheduledDate: string;
  @Expose() actualPickupTime: string;
  @Expose() qrCode: string;
  @Expose() instructions: string;
  // pickupCode is deliberately absent — stripped by excludeExtraneousValues
}

export class MerchantPickupDetailsDto extends ConsumerPickupDetailsDto {
  @Expose() pickupCode: string;
}

// ---------------------------------------------------------------------------
// Top-level order response DTOs
// ---------------------------------------------------------------------------

export class ConsumerOrderResponseDto {
  @Expose() _id: string;
  @Expose() orderNumber: string;
  @Expose() status: string;
  @Expose() paymentStatus: string;

  @Expose()
  @Type(() => PopulatedUserResponseDto)
  customerId: PopulatedUserResponseDto;

  @Expose()
  @Type(() => PopulatedEstablishmentResponseDto)
  establishmentId: PopulatedEstablishmentResponseDto;

  @Expose()
  @Type(() => PopulatedUserResponseDto)
  merchantId: PopulatedUserResponseDto;

  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @Expose()
  @Type(() => ConsumerPickupDetailsDto)
  pickupDetails: ConsumerPickupDetailsDto;

  @Expose()
  @Type(() => PaymentDetailsResponseDto)
  paymentDetails: PaymentDetailsResponseDto;

  @Expose()
  @Type(() => PricingResponseDto)
  pricing: PricingResponseDto;

  @Expose()
  @Type(() => EstablishmentAddressResponseDto)
  establishmentAddress: EstablishmentAddressResponseDto;

  @Expose() customerNotes: string;
  @Expose() merchantNotes: string;
  @Expose() cancellationReason: string;
  @Expose() donationAmount: number;
  @Expose() expiresAt: string;
  @Expose() isRated: boolean;
  @Expose() createdAt: string;
  @Expose() updatedAt: string;
}

export class MerchantOrderResponseDto extends ConsumerOrderResponseDto {
  // Override pickupDetails type to include the code
  @Expose()
  @Type(() => MerchantPickupDetailsDto)
  declare pickupDetails: MerchantPickupDetailsDto;
}
