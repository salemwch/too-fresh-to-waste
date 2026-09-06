import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { GOAL_SEQUENCE } from '../../donations/constants/goal-sequence.constant';
import { DEFAULT_CATEGORY_PRICES } from '../../donations/interfaces/donation.interface';
import { UserDonation, UserDonationDocument } from '../../donations/schemas/user-donation.schema';
import { Establishment } from '../../establishments/schemas/establishment.schema';
import type { FundLedgerResponse, FundedItem } from '../dto/sustainability.dto';

/**
 * TND to funded items, per category, at that category's price.
 *
 * Always floors. A merchant whose sales funded 9.99 TND toward a 10 TND t-shirt
 * funded zero t-shirts, and rounding that to one is the inflation the spec
 * forbids. Categories are emitted in GOAL_SEQUENCE order so the UI is stable.
 */
export function toFundedItems(amountByCategory: Record<string, number>): FundedItem[] {
  return GOAL_SEQUENCE.reduce<FundedItem[]>((acc, category) => {
    const amountTnd = amountByCategory[category];
    if (amountTnd === undefined) {
      return acc;
    }

    const price = DEFAULT_CATEGORY_PRICES[category]?.itemPrice;
    if (!price || price <= 0) {
      return acc;
    }

    acc.push({
      category,
      count: Math.floor(amountTnd / price),
      amountTnd: Math.round(amountTnd * 1000) / 1000,
    });
    return acc;
  }, []);
}

/** One row out of the `$group` stage in {@link FundLedgerService.getFundLedger}. */
export interface FundLedgerAggregationRow {
  _id: string | null;
  amount: number;
  count: number;
  /**
   * Nullable on purpose. `$min` returns `null` when every document in the
   * group is missing `contributedAt`, and `required: true` on the schema is a
   * write validator that does nothing for documents already stored - a
   * donation written before the field existed still hydrates without it. The
   * `row.first &&` guard in {@link accumulateFundLedgerRows} is load-bearing,
   * not dead code.
   */
  first: Date | null;
}

/**
 * Folds the raw aggregation rows into the response the controller returns.
 *
 * Pulled out of `getFundLedger` so the branching here - summing money for
 * rows with a null goal category while excluding them from `items`, and
 * picking the earliest `first` across rows rather than the first row seen -
 * can be unit-tested without touching MongoDB. The `$match`/`$group`
 * pipeline stays in the service; it is declarative and has nothing to branch
 * on.
 */
export function accumulateFundLedgerRows(rows: FundLedgerAggregationRow[]): FundLedgerResponse {
  const amountByCategory: Record<string, number> = {};
  let totalTnd = 0;
  let contributionCount = 0;
  let firstContributionAt: Date | null = null;

  for (const row of rows) {
    totalTnd += row.amount;
    contributionCount += row.count;
    if (row._id) {
      amountByCategory[row._id] = (amountByCategory[row._id] ?? 0) + row.amount;
    }
    if (row.first && (!firstContributionAt || row.first < firstContributionAt)) {
      firstContributionAt = row.first;
    }
  }

  const items = toFundedItems(amountByCategory);

  return {
    totalTnd: Math.round(totalTnd * 1000) / 1000,
    currency: 'TND',
    contributionCount,
    items,
    totalItems: items.reduce((sum, item) => sum + item.count, 0),
    firstContributionAt: firstContributionAt ? firstContributionAt.toISOString() : null,
  };
}

@Injectable()
export class FundLedgerService {
  constructor(
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<Establishment>,
  ) {}

  /**
   * The owning merchant of an establishment, as a string id.
   *
   * Donations are attributed to `order.merchantId`, which `order.service.ts`
   * sets to `establishment.ownerId` - never to a location manager's own user
   * id. A location manager therefore cannot read the ledger with their own
   * id: the `$match` would return zero rows and the card would show a new-shop
   * empty state to an establishment that has been trading for months.
   *
   * Returns null when the establishment is missing, soft-deleted or has no
   * owner. The caller must refuse the request in that case: falling back to
   * the caller's own id would silently widen the ledger past the one
   * establishment the manager is allowed to see.
   */
  async resolveEstablishmentOwnerId(establishmentId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(establishmentId)) {
      return null;
    }

    const establishment = await this.establishmentModel
      .findById(new Types.ObjectId(establishmentId))
      .select('ownerId')
      .lean<{ ownerId?: Types.ObjectId } | null>()
      .exec();

    return establishment?.ownerId ? establishment.ownerId.toString() : null;
  }

  async getFundLedger(merchantId: string, establishmentId?: string): Promise<FundLedgerResponse> {
    const match: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
    };
    if (establishmentId) {
      match['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const rows = await this.userDonationModel
      .aggregate<FundLedgerAggregationRow>([
        { $match: match },
        {
          $group: {
            _id: '$goalCategoryAtContribution',
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
            first: { $min: '$contributedAt' },
          },
        },
      ])
      .exec();

    return accumulateFundLedgerRows(rows);
  }
}
