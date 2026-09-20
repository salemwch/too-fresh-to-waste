import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types, isValidObjectId } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import {
  CommissionLedger,
  CommissionLedgerDocument,
  CommissionLedgerType,
} from '../../payments/schemas/commission-ledger.schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommissionMerchantRow {
  /** Duplicate of `establishmentId`. The admin table keys its rows on `id`. */
  id: string;
  establishmentId: string;
  establishmentName: string;
  merchantName: string;
  city: string | null;
  /** Outstanding balance the merchant owes. */
  commissionDue: number;
  /** Food subtotal across the period. */
  gmv: number;
  accrued: number;
  collected: number;
  /** `collected / gmv`. Drifts from 0.19 when something is wrong. */
  effectiveRate: number | null;
  ordersSinceSettlement: number;
  lastSettlementAt: string | null;
}

export interface CommissionSummary {
  totalDue: number;
  totalAccrued: number;
  totalCollected: number;
  gmv: number;
  effectiveRate: number | null;
  merchantsWithBalance: number;
  /** `accrued - collected - sum(commissionDue)`. Must be 0. */
  reconciliationDelta: number;
  reconciled: boolean;
}

export type CommissionSortKey =
  'commissionDue' | 'gmv' | 'accrued' | 'collected' | 'effectiveRate' | 'lastSettlementAt';

export interface CommissionQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  minDue?: number;
  maxDue?: number;
  /** Only rows whose effective rate is more than this far from 19%. */
  rateDriftAbove?: number;
  neverSettled?: boolean;
  from?: string;
  to?: string;
  sortBy?: CommissionSortKey;
  sortOrder?: 'asc' | 'desc';
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Admin view over merchant commission balances.
 *
 * Two independent sources have to agree, and the whole point of this module is
 * to show when they do not:
 *
 * - `Establishment.commissionDue` — the running balance the settlement path
 *   writes on every completed order.
 * - `commission_ledger` — the append-only history of how it got there.
 *
 * `sum(accrued) - sum(collected)` must equal `sum(commissionDue)` across the
 * platform. {@link getSummary} surfaces the difference rather than hiding it,
 * because a drift there means the ledger has lost money and no other screen in
 * the product would notice.
 */
@Injectable()
export class CommissionManagementService {
  private readonly logger = new Logger(CommissionManagementService.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly ledgerModel: Model<CommissionLedgerDocument>,
  ) {}

  /** TND is quoted to three decimals. Matches `round()` in `order-pricing.util.ts`. */
  private round(value: number): number {
    return parseFloat(value.toFixed(3));
  }

  /**
   * Period filter for ledger rows.
   *
   * Absent dates mean "all time" rather than defaulting to a window: an admin
   * hunting a reconciliation gap needs the full history, and a silent 30-day
   * default would make the totals look balanced while hiding the drift.
   */
  private periodMatch(from?: string, to?: string): FilterQuery<CommissionLedgerDocument> {
    if (!from && !to) {
      return {};
    }

    const createdAt: { $gte?: Date; $lte?: Date } = {};
    if (from) {
      const parsed = new Date(from);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid "from" date');
      }
      createdAt.$gte = parsed;
    }
    if (to) {
      const parsed = new Date(to);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid "to" date');
      }
      createdAt.$lte = parsed;
    }

    return { createdAt };
  }

  /**
   * One row per establishment that has any commission history or balance.
   *
   * Driven from the ledger rather than from establishments, so the list is
   * bounded by merchants who have actually traded instead of every record in
   * the collection.
   */
  async listMerchants(
    query: CommissionQuery,
  ): Promise<{ data: CommissionMerchantRow[]; total: number; page: number; limit: number }> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const sortBy = query.sortBy ?? 'commissionDue';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const pipeline: PipelineStage[] = [
      { $match: this.periodMatch(query.from, query.to) },
      {
        $group: {
          _id: '$establishmentId',
          accrued: {
            $sum: {
              $cond: [{ $eq: ['$type', CommissionLedgerType.ACCRUAL] }, '$amount', 0],
            },
          },
          collected: {
            $sum: {
              $cond: [{ $eq: ['$type', CommissionLedgerType.SETTLEMENT] }, '$amount', 0],
            },
          },
          /*
           * GMV is summed from ACCRUAL rows only. A settling order writes both
           * an ACCRUAL and a SETTLEMENT row carrying the same `orderSubtotal`,
           * so summing across every type would double-count those orders and
           * push the effective rate below 19% for exactly the merchants who
           * settle most often - the opposite of useful.
           */
          gmv: {
            $sum: {
              $cond: [
                { $eq: ['$type', CommissionLedgerType.ACCRUAL] },
                { $ifNull: ['$orderSubtotal', 0] },
                0,
              ],
            },
          },
          lastSettlementAt: {
            $max: {
              $cond: [{ $eq: ['$type', CommissionLedgerType.SETTLEMENT] }, '$createdAt', null],
            },
          },
          lastAccrualAt: {
            $max: {
              $cond: [{ $eq: ['$type', CommissionLedgerType.ACCRUAL] }, '$createdAt', null],
            },
          },
          accrualCount: {
            $sum: { $cond: [{ $eq: ['$type', CommissionLedgerType.ACCRUAL] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'establishments',
          localField: '_id',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                name: 1,
                commissionDue: 1,
                ownerId: 1,
                'address.city': 1,
              },
            },
          ],
          as: '_establishment',
        },
      },
      { $unwind: { path: '$_establishment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: '_establishment.ownerId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
          as: '_owner',
        },
      },
      { $unwind: { path: '$_owner', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          establishmentName: { $ifNull: ['$_establishment.name', 'Unknown'] },
          city: { $ifNull: ['$_establishment.address.city', null] },
          commissionDue: { $ifNull: ['$_establishment.commissionDue', 0] },
          merchantName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$_owner.firstName', ''] },
                  ' ',
                  { $ifNull: ['$_owner.lastName', ''] },
                ],
              },
            },
          },
          effectiveRate: {
            // Guarded: a merchant whose only rows fall outside the period has a
            // zero GMV, and $divide by 0 aborts the whole aggregation.
            $cond: [{ $gt: ['$gmv', 0] }, { $divide: ['$collected', '$gmv'] }, null],
          },
        },
      },
    ];

    // ── Filters that can only run after the lookup ──────────────────────────
    interface PostMatch {
      $or?: Record<string, unknown>[];
      $expr?: Record<string, unknown>;
      city?: string;
      commissionDue?: { $gte?: number; $lte?: number };
      lastSettlementAt?: null;
      effectiveRate?: { $ne: null };
    }

    const postMatch: PostMatch = {};

    if (query.search?.trim()) {
      // Escaped: the term is interpolated into a $regex, so an unescaped `(` or
      // `*` is at best a 500 and at worst a ReDoS against the whole collection.
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      postMatch.$or = [
        { establishmentName: { $regex: safe, $options: 'i' } },
        { merchantName: { $regex: safe, $options: 'i' } },
      ];
    }
    if (query.city?.trim()) {
      postMatch.city = query.city.trim();
    }
    if (query.minDue !== undefined || query.maxDue !== undefined) {
      postMatch.commissionDue = {
        ...(query.minDue !== undefined ? { $gte: query.minDue } : {}),
        ...(query.maxDue !== undefined ? { $lte: query.maxDue } : {}),
      };
    }
    if (query.neverSettled) {
      postMatch.lastSettlementAt = null;
    }
    if (query.rateDriftAbove !== undefined) {
      /*
       * Rows with no GMV in the period have a null rate and are excluded rather
       * than treated as maximum drift - "no data" is not "broken", and lumping
       * them in would bury the genuine drifts under inactive merchants.
       */
      postMatch.effectiveRate = { $ne: null };
      postMatch.$expr = {
        $gt: [
          { $abs: { $subtract: ['$effectiveRate', PLATFORM_FOOD_SHARE] } },
          query.rateDriftAbove,
        ],
      };
    }

    if (Object.keys(postMatch).length > 0) {
      pipeline.push({ $match: postMatch });
    }

    pipeline.push(
      { $sort: { [sortBy]: sortOrder, _id: 1 } as Record<string, 1 | -1> },
      {
        $facet: {
          rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    );

    type Raw = {
      _id: Types.ObjectId;
      establishmentName: string;
      merchantName: string;
      city: string | null;
      commissionDue: number;
      gmv: number;
      accrued: number;
      collected: number;
      effectiveRate: number | null;
      accrualCount: number;
      lastSettlementAt: Date | null;
    };

    const [result] = await this.ledgerModel
      .aggregate<{ rows: Raw[]; count: { total: number }[] }>(pipeline)
      .exec();

    const rows = result?.rows ?? [];
    const total = result?.count[0]?.total ?? 0;

    return {
      data: rows.map(row => ({
        id: row._id.toString(),
        establishmentId: row._id.toString(),
        establishmentName: row.establishmentName,
        merchantName: row.merchantName || 'Unknown',
        city: row.city,
        commissionDue: this.round(row.commissionDue),
        gmv: this.round(row.gmv),
        accrued: this.round(row.accrued),
        collected: this.round(row.collected),
        effectiveRate: row.effectiveRate,
        ordersSinceSettlement: row.accrualCount,
        lastSettlementAt: row.lastSettlementAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Platform totals, plus the reconciliation identity.
   *
   * `accrued - collected` is what the ledger says is outstanding.
   * `sum(commissionDue)` is what the establishments say. They must match; the
   * delta is the only number on this screen that should ever be alarming.
   *
   * Computed over all time regardless of the period filter, because a partial
   * window cannot reconcile against a running balance that spans all of it.
   */
  async getSummary(): Promise<CommissionSummary> {
    const [ledgerTotals, balanceTotals] = await Promise.all([
      this.ledgerModel
        .aggregate<{ _id: null; accrued: number; collected: number; gmv: number }>([
          {
            $group: {
              _id: null,
              accrued: {
                $sum: { $cond: [{ $eq: ['$type', CommissionLedgerType.ACCRUAL] }, '$amount', 0] },
              },
              collected: {
                $sum: {
                  $cond: [{ $eq: ['$type', CommissionLedgerType.SETTLEMENT] }, '$amount', 0],
                },
              },
              gmv: {
                $sum: {
                  $cond: [
                    { $eq: ['$type', CommissionLedgerType.ACCRUAL] },
                    { $ifNull: ['$orderSubtotal', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      this.establishmentModel
        .aggregate<{ _id: null; totalDue: number; withBalance: number }>([
          { $match: { commissionDue: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              totalDue: { $sum: '$commissionDue' },
              withBalance: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    const accrued = this.round(ledgerTotals[0]?.accrued ?? 0);
    const collected = this.round(ledgerTotals[0]?.collected ?? 0);
    const gmv = this.round(ledgerTotals[0]?.gmv ?? 0);
    const totalDue = this.round(balanceTotals[0]?.totalDue ?? 0);

    const reconciliationDelta = this.round(accrued - collected - totalDue);

    /*
     * Tolerance of one millime per the rounding convention. Both sides round
     * independently at write time, so an exact zero is not achievable across a
     * large ledger and demanding it would cry wolf on every screen load.
     */
    const reconciled = Math.abs(reconciliationDelta) <= 0.001;

    if (!reconciled) {
      this.logger.error(
        `Commission reconciliation drift: ledger outstanding ${this.round(
          accrued - collected,
        )} TND vs balances ${totalDue} TND (delta ${reconciliationDelta} TND)`,
      );
    }

    return {
      totalDue,
      totalAccrued: accrued,
      totalCollected: collected,
      gmv,
      effectiveRate: gmv > 0 ? collected / gmv : null,
      merchantsWithBalance: balanceTotals[0]?.withBalance ?? 0,
      reconciliationDelta,
      reconciled,
    };
  }

  /** Full movement history for one establishment, newest first. */
  async getLedger(
    establishmentId: string,
    page = 1,
    limit = 50,
  ): Promise<{
    data: {
      id: string;
      type: CommissionLedgerType;
      amount: number;
      balanceAfter: number;
      orderSubtotal: number | null;
      merchantAmount: number | null;
      orderId: string | null;
      reason: string | null;
      /** `null` only for rows written outside Mongoose, which have no timestamp. */
      createdAt: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
    establishmentName: string;
    commissionDue: number;
  }> {
    if (!isValidObjectId(establishmentId)) {
      throw new BadRequestException('Invalid establishment ID');
    }

    const establishment = await this.establishmentModel
      .findById(establishmentId)
      .select('name commissionDue')
      .lean();

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safePage = Math.max(page, 1);
    const filter = { establishmentId: new Types.ObjectId(establishmentId) };

    const [rows, total] = await Promise.all([
      this.ledgerModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      this.ledgerModel.countDocuments(filter),
    ]);

    return {
      data: rows.map(row => ({
        id: row._id.toString(),
        type: row.type,
        amount: this.round(row.amount),
        balanceAfter: this.round(row.balanceAfter),
        orderSubtotal: row.orderSubtotal ?? null,
        merchantAmount: row.merchantAmount ?? null,
        orderId: row.orderId?.toString() ?? null,
        reason: row.reason ?? null,
        /*
         * `timestamps: true` fills this on every write through Mongoose, but a
         * row inserted by a migration or the raw driver has no `createdAt`, and
         * calling `.toISOString()` on it took down the whole endpoint rather
         * than one row. An audit trail that cannot be read is worse than one
         * with a gap in it.
         */
        createdAt: (row as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
      establishmentName: establishment.name,
      commissionDue: this.round(establishment.commissionDue ?? 0),
    };
  }

  /** Distinct cities present in the commission data, for the filter control. */
  async getCities(): Promise<string[]> {
    const cities = await this.establishmentModel.distinct('address.city', {
      commissionDue: { $exists: true },
    });

    return cities.filter((c): c is string => typeof c === 'string' && c.length > 0).sort();
  }
}
