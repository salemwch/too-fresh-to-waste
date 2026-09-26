import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import { appError } from '../common/errors';
import { SentryService } from '../common/services/sentry.service';
import { parseCommissionCutoff } from '../config/commission-cutoff.util';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from '../orders/utils/order-pricing.util';
import { salesBaseStages, type PaymentLine, type SalesCase } from './merchant-sales.expressions';
import {
  resolveSalesPeriod,
  salesSlots,
  SALES_TIMEZONE,
  type SalesPeriod,
} from './merchant-sales.period';
import { scopeMatch, type SalesScope } from './merchant-sales.scope';
import { summariseSalesGroups } from './merchant-sales.summarise';
import {
  MERCHANT_EARNINGS_UNVERIFIED_ORDERS,
  type EarningsRow,
  type EarningsTab,
  type MerchantSalesChart,
  type MerchantSalesSummary,
  type SalesGroupRow,
} from './merchant-sales.types';

const MAX_REPORTED_IDS = 20;

/**
 * The single computation behind every merchant earnings figure - Dashboard,
 * Payments and Analytics all read this. See .claude/work/merchant-earnings.md.
 */
@Injectable()
export class MerchantSalesService {
  private readonly logger = new Logger(MerchantSalesService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly configService: ConfigService,
    private readonly sentry: SentryService,
  ) {}

  /** Null in development when unset: the model is inactive, nothing is case 3. */
  cutoff(): Date | null {
    return parseCommissionCutoff(this.configService.get<string>('COMMISSION_MODEL_EFFECTIVE_AT'));
  }

  baseStages(scope: SalesScope, range: { from: Date | null; to: Date }): PipelineStage[] | null {
    const match = scopeMatch(scope);
    return match
      ? salesBaseStages({ scope: match, from: range.from, to: range.to, cutoff: this.cutoff() })
      : null;
  }

  async summary(
    scope: SalesScope,
    period: SalesPeriod,
    now: Date = new Date(),
  ): Promise<MerchantSalesSummary> {
    const range = resolveSalesPeriod(period, now);
    const result = await this.compute(scope, range, period);
    return result;
  }

  async summaryForRange(
    scope: SalesScope,
    range: { from: Date | null; to: Date },
  ): Promise<MerchantSalesSummary> {
    const result = await this.compute(scope, range, 'custom');
    return result;
  }

  /**
   * The chart built from exactly the same population as `summary`, so its
   * slots always add up to the summary total (Task 7). Gaps (an hour, day or
   * month with no sale) are filled with a 0 slot rather than omitted.
   */
  async chart(
    scope: SalesScope,
    period: SalesPeriod,
    now: Date = new Date(),
  ): Promise<MerchantSalesChart> {
    const range = resolveSalesPeriod(period, now);
    const stages = this.baseStages(scope, range);
    const buckets = stages
      ? await this.orderModel.aggregate<{
          _id: Date;
          orders: number;
          bags: number;
          earnedMillimes: number;
        }>([
          ...stages,
          { $match: { _population: 'earnings' } },
          {
            $group: {
              _id: {
                $dateTrunc: { date: '$_moment', unit: range.granularity, timezone: SALES_TIMEZONE },
              },
              orders: { $sum: 1 },
              bags: { $sum: { $sum: '$items.quantity' } },
              earnedMillimes: { $sum: '$_earnedMillimes' },
            },
          },
          { $sort: { _id: 1 } },
        ])
      : [];

    const byStart = new Map(buckets.map(b => [b._id.getTime(), b]));
    const slots = salesSlots(range, buckets[0]?._id ?? null, now).map(start => {
      const b = byStart.get(start.getTime());
      return {
        start: start.toISOString(),
        orders: b?.orders ?? 0,
        bags: b?.bags ?? 0,
        earned: (b?.earnedMillimes ?? 0) / 1000,
      };
    });

    return { period, granularity: range.granularity, slots };
  }

  /**
   * The exact orders behind a Payments tab, newest first, paginated with a
   * stable `${momentMs}.${orderId}` cursor so ties on the same moment are
   * neither repeated nor skipped across pages (Task 8).
   */
  async rows(
    scope: SalesScope,
    period: SalesPeriod,
    tab: EarningsTab,
    page: { after?: string; limit: number },
    now: Date = new Date(),
  ): Promise<{ rows: EarningsRow[]; hasMore: boolean; nextCursor?: string }> {
    const stages = this.baseStages(scope, resolveSalesPeriod(period, now));
    if (!stages) {
      return { rows: [], hasMore: false };
    }
    const cursor = page.after ? parseEarningsCursor(page.after) : null;
    const docs = await this.orderModel.aggregate<RawEarningsRow>([
      ...stages,
      { $match: { _population: tab } },
      ...(cursor
        ? [
            {
              $match: {
                $or: [
                  { _moment: { $lt: cursor.moment } },
                  { _moment: cursor.moment, _id: { $lt: cursor.id } },
                ],
              },
            },
          ]
        : []),
      { $sort: { _moment: -1, _id: -1 } },
      { $limit: page.limit + 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          as: '_customer',
          pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: '_est',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
    ]);

    const hasMore = docs.length > page.limit;
    const pageDocs = hasMore ? docs.slice(0, page.limit) : docs;
    const last = pageDocs.at(-1);
    return {
      rows: pageDocs.map(toEarningsRow),
      hasMore,
      ...(hasMore && last
        ? { nextCursor: `${last._moment.getTime()}.${last._id.toString()}` }
        : {}),
    };
  }

  private async compute(
    scope: SalesScope,
    range: { from: Date | null; to: Date },
    period: MerchantSalesSummary['period'],
  ): Promise<MerchantSalesSummary> {
    const stages = this.baseStages(scope, range);
    const groups = stages
      ? await this.orderModel.aggregate<SalesGroupRow>([
          ...stages,
          {
            $group: {
              _id: { population: '$_population', line: '$_line' },
              orders: { $sum: 1 },
              earnedMillimes: { $sum: '$_earnedMillimes' },
              // Food price after the offer discount, and the pre-discount value.
              foodMillimes: {
                $sum: {
                  $toLong: {
                    $round: [{ $multiply: [{ $ifNull: ['$pricing.subtotal', 0] }, 1000] }, 0],
                  },
                },
              },
              originalMillimes: {
                $sum: {
                  $toLong: {
                    $round: [
                      {
                        $multiply: [
                          {
                            $add: [
                              { $ifNull: ['$pricing.subtotal', 0] },
                              { $ifNull: ['$pricing.discountAmount', 0] },
                            ],
                          },
                          1000,
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
              accruedMillimes: {
                $sum: {
                  $toLong: {
                    $round: [{ $multiply: [{ $ifNull: ['$commission.accrued', 0] }, 1000] }, 0],
                  },
                },
              },
              settledMillimes: {
                $sum: {
                  $toLong: {
                    $round: [{ $multiply: [{ $ifNull: ['$commission.settled', 0] }, 1000] }, 0],
                  },
                },
              },
              unverifiedIds: {
                $push: { $cond: [{ $eq: ['$_population', 'verifying'] }, '$_id', '$$REMOVE'] },
              },
            },
          },
        ])
      : [];

    const summarised = summariseSalesGroups(groups);
    if (summarised.unverifiedOrders > 0) {
      this.reportUnverified(scope, period, summarised.unverifiedOrders, summarised.unverifiedIds);
    }

    return {
      period,
      from: range.from ? range.from.toISOString() : null,
      to: range.to.toISOString(),
      currency: 'TND',
      total: summarised.total,
      channels: summarised.channels,
      commission: { rate: PLATFORM_FOOD_SHARE, ...summarised.commission },
      unverifiedOrders: summarised.unverifiedOrders,
    };
  }

  /** One report per request, never one per order. */
  private reportUnverified(scope: SalesScope, period: string, count: number, ids: string[]): void {
    const details = {
      code: MERCHANT_EARNINGS_UNVERIFIED_ORDERS,
      scope: scope.kind === 'merchant' ? { merchantId: scope.merchantId } : scope,
      count,
      period,
      orderIds: ids.slice(0, MAX_REPORTED_IDS),
    };
    this.logger.error(
      `${MERCHANT_EARNINGS_UNVERIFIED_ORDERS}: ${count} post-cutoff sales without a commission decision`,
      details,
    );
    this.sentry.captureMessage(
      `${MERCHANT_EARNINGS_UNVERIFIED_ORDERS}: post-cutoff sales without a commission decision`,
      'error',
      { merchantEarnings: details },
      [MERCHANT_EARNINGS_UNVERIFIED_ORDERS],
    );
  }
}

interface RawEarningsRow {
  _id: Types.ObjectId;
  orderNumber: string;
  status: string;
  refundReason?: string;
  pricing?: { subtotal?: number };
  commission?: { kind: 'NORMAL' | 'SETTLEMENT' };
  _moment: Date;
  _case: SalesCase;
  _line: PaymentLine;
  _earnedMillimes: number;
  _customer: Array<{ firstName?: string; lastName?: string }>;
  _est: Array<{ name?: string }>;
}

const CURSOR_RE = /^(\d{1,15})\.([0-9a-f]{24})$/;

function parseEarningsCursor(raw: string): { moment: Date; id: Types.ObjectId } {
  const match = CURSOR_RE.exec(raw);
  if (!match) {
    throw new BadRequestException(appError('INVALID_CURSOR'));
  }
  return { moment: new Date(Number(match[1])), id: new Types.ObjectId(match[2]) };
}

function toEarningsRow(doc: RawEarningsRow): EarningsRow {
  const customer = doc._customer[0];
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');
  return {
    orderId: doc._id.toString(),
    orderNumber: doc.orderNumber,
    customerName: name || null,
    establishmentName: doc._est[0]?.name ?? null,
    line: doc._line,
    subtotal: doc.pricing?.subtotal ?? 0,
    earned: doc._earnedMillimes / 1000,
    kind: doc._case === 'CURRENT' ? (doc.commission?.kind ?? 'NORMAL') : doc._case,
    commissionMoment: doc._moment.toISOString(),
    status: doc.status,
    refundReason: doc.refundReason ?? null,
  };
}
