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

import { appError } from '../../common/errors';
export interface EstablishmentCommissionDue {
  establishmentId: string;
  name: string;
  amount: number;
}

export interface MerchantCommissionStatement {
  /** What the merchant still owes, summed over every establishment in scope. */
  commissionDue: number;
  /**
   * The same balance per establishment, largest first, zero balances omitted.
   * Present so an all-locations statement never hides which location carries
   * the balance - the reason the statement used to be single-location only.
   */
  dueByEstablishment: EstablishmentCommissionDue[];
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

type OwnedEstablishment = Pick<EstablishmentDocument, 'name' | 'commissionDue'> & {
  _id: Types.ObjectId;
};

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
   * @param establishmentId  One establishment, or `undefined` for every
   *                         establishment the caller owns ("All locations").
   * @param ownerId  From the JWT. Checked against the establishment's owner so
   *                 a merchant cannot read another merchant's balance by id.
   */
  async getStatement(
    establishmentId: string | undefined,
    ownerId: string,
    from?: Date,
    to?: Date,
  ): Promise<MerchantCommissionStatement> {
    const establishments =
      establishmentId === undefined
        ? await this.ownedEstablishments(ownerId)
        : [await this.ownedEstablishment(establishmentId, ownerId)];

    return this.buildStatement(establishments, from, to);
  }

  /**
   * Every establishment the merchant owns, deleted ones included: a balance or
   * a sale recorded this month does not stop being true because the location
   * was later closed.
   */
  private async ownedEstablishments(ownerId: string): Promise<OwnedEstablishment[]> {
    if (!isValidObjectId(ownerId)) {
      return [];
    }
    const owned = await this.establishmentModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .select('_id name commissionDue')
      .lean<OwnedEstablishment[]>();
    return owned;
  }

  private async ownedEstablishment(
    establishmentId: string,
    ownerId: string,
  ): Promise<OwnedEstablishment> {
    if (!isValidObjectId(establishmentId)) {
      throw new NotFoundException(appError('ESTABLISHMENT_NOT_FOUND'));
    }

    const establishment = await this.establishmentModel
      .findById(establishmentId)
      .select('_id name ownerId commissionDue')
      .lean();

    if (!establishment) {
      throw new NotFoundException(appError('ESTABLISHMENT_NOT_FOUND'));
    }

    /*
     * Ownership check, not a role check. `@Roles(MERCHANT)` only proves the
     * caller is *a* merchant - without this, any merchant could read any other
     * merchant's outstanding balance by guessing an establishment id.
     */
    if (establishment.ownerId.toString() !== ownerId) {
      throw new ForbiddenException(appError('ESTABLISHMENT_NOT_YOURS'));
    }

    return establishment;
  }

  private async buildStatement(
    establishments: OwnedEstablishment[],
    from?: Date,
    to?: Date,
  ): Promise<MerchantCommissionStatement> {
    // Default window is the current calendar month - the unit a merchant
    // actually reconciles against, and the one their own books use.
    const now = new Date();
    const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ?? now;

    // A merchant with no establishment yet has an empty month, not an error.
    const rows =
      establishments.length === 0
        ? []
        : await this.ledgerModel
            .find({
              establishmentId: { $in: establishments.map(e => e._id) },
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

    const dueByEstablishment = establishments
      .map(e => ({
        establishmentId: e._id.toString(),
        name: e.name,
        amount: this.round(e.commissionDue ?? 0),
      }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      // Summed from the unrounded balances, then rounded once, so the total
      // cannot drift a millime away from the stored figures.
      commissionDue: this.round(establishments.reduce((sum, e) => sum + (e.commissionDue ?? 0), 0)),
      dueByEstablishment,
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
