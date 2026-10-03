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

/**
 * A7: `pricing.deliveryFee`/`pricing.total` and `paymentDetails.amount` are in
 * `STRIP_PATHS` (`orders/utils/merchant-order-view.ts`) - removed from every
 * real merchant/location-manager response before it reaches this DTO. The
 * consumer-shaped sub-DTOs above declared them as always-present `!` fields
 * anyway, which a future call site could trust and leak. These two mirror the
 * same STRIP_PATHS classification so the DTO's own shape cannot lie about it,
 * with a schema-coverage test (`merchant-order-response-dto-money.spec.ts`)
 * tying them together.
 */
class MerchantPricingResponseDto implements Omit<PricingResponse, 'deliveryFee' | 'total'> {
  @Expose() subtotal!: number;
  @Expose() discountAmount!: number;
  @Expose() taxAmount!: number;
  @Expose() currency!: string;
}

class MerchantPaymentDetailsResponseDto implements Omit<PaymentDetailsResponse, 'amount'> {
  @Expose() method!: string;
  @Expose() currency!: string;
}

/**
 * The merchant's own frozen commission decision - never delivery money (see
 * `orders/utils/merchant-order-view.ts`). Exposed on `MerchantOrderResponseDto`
 * only: a customer has no use for it, and it is absent until pickup is
 * confirmed (`order.commission` is written by `CommissionService` at that
 * point, never before).
 */
class CommissionResponseDto {
  @Expose() model!: 'LEGACY' | 'V2';
  @Expose() kind!: 'NORMAL' | 'SETTLEMENT';
  @Expose() controlledBy?: 'TFTW' | 'MERCHANT' | undefined;
  @Expose() accrued!: number;
  @Expose() settled!: number;
  @Expose() merchantAmount!: number;
  @Expose() dueBefore!: number;
  @Expose() dueAfter!: number;
  @Expose() appliedAt!: string;
}

/**
 * "Your earnings" - built by `orderEarningsFor` (merchant-sales.expressions.ts)
 * from the same three cases as the Dashboard/Payments calculation, never a
 * second formula (A2). Absent entirely until the order has a commission
 * moment (not yet picked up / collected); `amount` is null for a REFUNDED
 * order or a post-cutoff order still awaiting its decision (`verifying`).
 */
class OrderEarningsResponseDto {
  @Expose() amount!: number | null;
  @Expose() verifying!: boolean;
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

/**
 * Everything a consumer and a merchant/location-manager order view share.
 * `pricing`, `paymentDetails`, `paymentSession` and `pickupDetails` are
 * declared separately on each subclass below rather than here: the merchant
 * shape removes required fields from each (STRIP_PATHS), which is not a valid
 * subtype of the consumer shape - declaring them on a shared base and letting
 * each side narrow independently, instead of one extending the other for
 * these fields, is what makes that honest (A7).
 */
class BaseOrderResponseDto {
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
  @Expose() completedAt!: string;
  @Expose() pendingPaymentAt!: string;
  @Expose() deliveryMode!: string;
  @Expose() payUrl?: string;
}

export class ConsumerOrderResponseDto extends BaseOrderResponseDto {
  @Expose()
  @Type(() => ConsumerPickupDetailsDto)
  pickupDetails!: ConsumerPickupDetailsDto;

  @Expose()
  @Type(() => PaymentDetailsResponseDto)
  paymentDetails!: PaymentDetailsResponseDto;

  @Expose()
  @Type(() => PricingResponseDto)
  pricing!: PricingResponseDto;

  @Expose() paymentSession!: {
    provider: string;
    reference: string;
    payUrl: string;
    expiresAt: string;
  };
}

export class MerchantOrderResponseDto extends BaseOrderResponseDto {
  @Expose()
  @Type(() => MerchantPickupDetailsDto)
  pickupDetails!: MerchantPickupDetailsDto;

  // A7: the STRIP_PATHS-true shape - no deliveryFee/total/amount, no
  // paymentSession at all (`STRIP_PATHS` has it as a bare top-level key).
  @Expose()
  @Type(() => MerchantPricingResponseDto)
  pricing!: MerchantPricingResponseDto;

  @Expose()
  @Type(() => MerchantPaymentDetailsResponseDto)
  paymentDetails!: MerchantPaymentDetailsResponseDto;

  // paymentSession is deliberately absent - never @Expose()'d here.

  // The merchant's own commission decision - see CommissionResponseDto above.
  // Absent from ConsumerOrderResponseDto: a customer never sees it.
  @Expose()
  @Type(() => CommissionResponseDto)
  commission?: CommissionResponseDto | undefined;

  // "Your earnings" - see OrderEarningsResponseDto above. Same gate as
  // `commission` (MERCHANT / LOCATION_MANAGER / ADMIN only).
  @Expose()
  @Type(() => OrderEarningsResponseDto)
  earnings?: OrderEarningsResponseDto | undefined;
}
