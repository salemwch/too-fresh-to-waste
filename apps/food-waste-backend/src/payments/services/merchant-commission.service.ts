import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import {
  CommissionLedger,
  CommissionLedgerDocument,
  CommissionLedgerType,
} from '../schemas/commission-ledger.schema';

export interface MerchantCommissionStatement {
  /** What the merchant still owes. */
  commissionDue: number;
  /** Food sales in the period. */
  sales: number;
  /** Commission charged on those sales. */
  commission: number;
  /** Sales minus commission - what the merchant keeps. */
  received: number;
  /** The headline rate, so the merchant can check the arithmetic themselves. */
  rate: number;
  /** Orders in the period that paid the merchant the full price. */
  fullPriceOrders: number;
  /** Orders in the period that settled part of the balance. */
  settledOrders: number;
  currency: string;
  recentSettlements: {
    orderId: string | null;
    amount: number;
    merchantAmount: number | null;
    orderSubtotal: number | null;
    createdAt: string;
  }[];
}

/**
 * The merchant's own view of their commission.
 *
 * Deliberately **not** the admin view with the names changed. An admin needs
 * drift detection; a merchant needs to understand what they were paid and why,
 * without the arrangement ever reading as a deduction.
 *
 * So this returns the month in the shape a merchant already understands - sold,
 * commission, received - which is identical to any ordinary commission
 * statement. The per-order lumpiness is a payout detail; the month is the
 * truth, and it reconciles to exactly 19%.
 */
@Injectable()
export class MerchantCommissionService {
  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly ledgerModel: Model<CommissionLedgerDocument>,
  ) {}

  private round(value: number): number {
    return parseFloat(value.toFixed(3));
  }

  /**
   * @param ownerId  From the JWT. Checked against the establishment's owner so
   *                 a merchant cannot read another merchant's balance by id.
   */
  async getStatement(
    establishmentId: string,
    ownerId: string,
    from?: Date,
    to?: Date,
  ): Promise<MerchantCommissionStatement> {
    if (!isValidObjectId(establishmentId)) {
      throw new NotFoundException('Establishment not found');
    }

    const establishment = await this.establishmentModel
      .findById(establishmentId)
      .select('ownerId commissionDue')
      .lean();

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    /*
     * Ownership check, not a role check. `@Roles(MERCHANT)` only proves the
     * caller is *a* merchant - without this, any merchant could read any other
     * merchant's outstanding balance by guessing an establishment id.
     */
    if (establishment.ownerId.toString() !== ownerId) {
      throw new ForbiddenException('You can only view your own establishment');
    }

    // Default window is the current calendar month - the unit a merchant
    // actually reconciles against, and the one their own books use.
    const now = new Date();
    const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ?? now;

    const rows = await this.ledgerModel
      .find({
        establishmentId: new Types.ObjectId(establishmentId),
        createdAt: { $gte: start, $lte: end },
      })
      .sort({ createdAt: -1 })
      .lean();

    let sales = 0;
    let commission = 0;
    let fullPriceOrders = 0;
    let settledOrders = 0;

    for (const row of rows) {
      if (row.type === CommissionLedgerType.ACCRUAL) {
        sales += row.orderSubtotal ?? 0;
        commission += row.amount;
        /*
         * `merchantAmount === orderSubtotal` is what "paid in full" means here.
         * Counting orders without a settlement row instead would need a second
         * pass and would miscount an order settled to the cap exactly.
         */
        if (typeof row.merchantAmount === 'number' && typeof row.orderSubtotal === 'number') {
          if (row.merchantAmount >= row.orderSubtotal) {
            fullPriceOrders += 1;
          } else {
            settledOrders += 1;
          }
        }
      }
    }

    const recentSettlements = rows
      .filter(row => row.type === CommissionLedgerType.SETTLEMENT)
      .slice(0, 10)
      .map(row => ({
        orderId: row.orderId?.toString() ?? null,
        amount: this.round(row.amount),
        merchantAmount: row.merchantAmount ?? null,
        orderSubtotal: row.orderSubtotal ?? null,
        createdAt: (row as unknown as { createdAt: Date }).createdAt.toISOString(),
      }));

    const roundedSales = this.round(sales);
    const roundedCommission = this.round(commission);

    return {
      commissionDue: this.round(establishment.commissionDue ?? 0),
      sales: roundedSales,
      commission: roundedCommission,
      received: this.round(roundedSales - roundedCommission),
      rate: PLATFORM_FOOD_SHARE,
      fullPriceOrders,
      settledOrders,
      currency: 'TND',
      recentSettlements,
    };
  }
}
