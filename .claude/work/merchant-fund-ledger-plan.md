# Merchant Community Fund Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the community fund visible to the merchant who generated it, with
historically accurate figures from day one.

**Architecture:** Attribute every `UserDonation` to the merchant and
establishment whose sale produced it, denormalized at write time so the
dashboard read is one indexed aggregation rather than a join. Backfill
historical donations before the feature ships. Expose a merchant-scoped ledger
endpoint and render it as a dashboard card.

**Tech Stack:** NestJS 11, Mongoose, MongoDB (single-node replica set locally),
Next.js 15 App Router, TanStack Query 5, next-intl 4.7.

**Spec:** `.claude/work/merchant-impact-social-proof.md` (status
`ready-for-dev`). This plan implements the ledger slice of P0 only. Two sibling
plans follow: the public merchant profile, and impact snapshots plus share
cards.

## Global Constraints

- Backend uses **relative imports only**. No `@/` or `@foodwaste/*` inside
  backend source.
- `@Prop()` on a union type **must** pass explicit `type:` - `reflect-metadata`
  emits `Object` for unions.
- `exactOptionalPropertyTypes` is on. Never pass `val | undefined` to an
  optional prop; use conditional spread `...(v ? { k: v } : {})`.
- Response envelope is `{ status: number, message: string, data: T, meta? }`.
  Web reads `response.data.data`.
- Copy says **"your sales funded"**, never "you donated". The money comes from
  the platform's 19% margin.
- **No em dash anywhere.** Use `-`.
- Translation keys land in `en.json`, `fr.json` and `ar.json` in the same
  commit, and the namespace must be added to the `(merchant)` layout's namespace
  array or keys render raw.
- Every new index is declared on the schema. `verify:indexes:strict` is the
  gate. Never mix `sparse` with `partialFilterExpression`.
- Gate: `pnpm --filter @foodwaste/backend check:all` and
  `pnpm --filter @foodwaste/web type-check && pnpm --filter @foodwaste/web test`.

## File Structure

**Backend**

| File                                                           | Responsibility                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/common/events/order.events.ts`                            | Add optional `establishmentId` to `OrderCompletedEvent`                   |
| `src/orders/order.service.ts:1369`                             | Pass `establishmentId` at the single emit site                            |
| `src/donations/schemas/user-donation.schema.ts`                | Add `merchantId`, `establishmentId`, `goalCategoryAtContribution` + index |
| `src/donations/interfaces/donation.interface.ts`               | Extend `CreateDonationInput`                                              |
| `src/donations/donations.service.ts`                           | Persist the three new fields                                              |
| `src/donations/listeners/order-events.listener.ts`             | Pass attribution, fall back to an order lookup                            |
| `src/sustainability/services/fund-ledger.service.ts`           | **New.** The ledger aggregation and item conversion                       |
| `src/sustainability/dto/sustainability.dto.ts`                 | `FundLedgerResponse`                                                      |
| `src/sustainability/controllers/sustainability.controller.ts`  | `GET /sustainability/fund-ledger`                                         |
| `scripts/migrations/backfill-donation-merchant-attribution.ts` | **New.** Historical backfill                                              |

**Web**

| File                                                     | Responsibility                   |
| -------------------------------------------------------- | -------------------------------- |
| `src/types/dashboard.ts`                                 | `FundLedgerResponse` type        |
| `src/services/dashboard.service.ts`                      | `getFundLedger()`                |
| `src/hooks/use-merchant-dashboard.ts`                    | `useFundLedger()` + query key    |
| `src/components/dashboard/merchant/fund-ledger-card.tsx` | **New.** The card                |
| `src/messages/{en,fr,ar}.json`                           | `dashboard.fundLedger` namespace |

A new `fund-ledger.service.ts` rather than growing `sustainability.service.ts`:
that file is already 297 lines with four public aggregations, and the ledger
reads a different collection (`user_donations`, not `orders`) for a different
purpose.

---

### Task 1: Carry `establishmentId` on the order-completed event

`OrderCompletedEvent` already carries `merchantId` (`order.events.ts:16`) but
not `establishmentId`. The event crosses RabbitMQ, and
`handleOrderCompletedRabbitMQ` Nacks with requeue on error, so a message
serialized before deploy must not break after it. The field is therefore
**optional**, and Task 2 adds the fallback.

**Files:**

- Modify: `apps/food-waste-backend/src/common/events/order.events.ts:12-28`
- Modify: `apps/food-waste-backend/src/orders/order.service.ts:1369-1381`
- Test:
  `apps/food-waste-backend/src/common/events/__tests__/order-completed-event.spec.ts`
  (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `OrderCompletedEvent` with trailing
  `public readonly establishmentId?: string`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/food-waste-backend/src/common/events/__tests__/order-completed-event.spec.ts
import { plainToClass } from 'class-transformer';

import { OrderCompletedEvent } from '../order.events';

describe('OrderCompletedEvent', () => {
  it('carries establishmentId when constructed with one', () => {
    const event = new OrderCompletedEvent(
      'order-1',
      'user-1',
      'merchant-1',
      'offer-1',
      12.5,
      new Date(),
      { itemCount: 1 },
      10,
      'establishment-1',
    );

    expect(event.establishmentId).toBe('establishment-1');
    expect(event.subtotalAmount).toBe(10);
  });

  it('tolerates an old-shape message with no establishmentId', () => {
    // A message serialized by the previous release, still in the RabbitMQ queue
    // across a deploy. It must deserialize without throwing so the consumer can
    // fall back to an order lookup instead of Nacking into a requeue loop.
    const legacy = {
      orderId: 'order-2',
      userId: 'user-2',
      merchantId: 'merchant-2',
      offerId: 'offer-2',
      totalAmount: 20,
      completedAt: new Date().toISOString(),
      subtotalAmount: 18,
    };

    const event = plainToClass(OrderCompletedEvent, legacy);

    expect(event.establishmentId).toBeUndefined();
    expect(event.merchantId).toBe('merchant-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`pnpm --filter @foodwaste/backend exec jest src/common/events/__tests__/order-completed-event.spec.ts --runInBand`
Expected: FAIL. TypeScript rejects the 9th constructor argument, or
`establishmentId` does not exist on the type.

- [ ] **Step 3: Add the optional trailing field**

```ts
// apps/food-waste-backend/src/common/events/order.events.ts
export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly merchantId: string,
    public readonly offerId: string,
    public readonly totalAmount: number,
    public readonly completedAt: Date,
    public readonly metadata?: {
      itemCount?: number;
      isFirstOrder?: boolean;
      paymentMethod?: string;
    },
    /** Bag price before delivery fee - used for charity calculation (5% of platform cut) */
    public readonly subtotalAmount: number = totalAmount,
    /**
     * Optional on purpose. Messages serialized before this field existed are
     * still in the queue across a deploy; the donation listener falls back to an
     * order lookup rather than rejecting them.
     */
    public readonly establishmentId?: string,
  ) {}
}
```

- [ ] **Step 4: Pass it at the single emit site**

`order.service.ts:1369`. `order.establishmentId` may be a populated document or
a raw `ObjectId`, which is why this normalizes both.

```ts
          new OrderCompletedEvent(
            orderId,
            order.customerId._id.toString(),
            order.merchantId._id.toString(),
            order.items[0]?.offerId.toString() ?? '',
            order.pricing?.total || 0,
            new Date(),
            {
              itemCount: totalBags,
              isFirstOrder: false,
            },
            order.pricing?.subtotal || 0,
            order.establishmentId
              ? ((order.establishmentId as { _id?: unknown })._id ?? order.establishmentId).toString()
              : undefined,
          ),
```

- [ ] **Step 5: Run test to verify it passes**

Run:
`pnpm --filter @foodwaste/backend exec jest src/common/events/__tests__/order-completed-event.spec.ts --runInBand`
Expected: PASS, both cases.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @foodwaste/backend check:ts` Expected: clean. If it
complains about passing `string | undefined` to an optional parameter, that is
`exactOptionalPropertyTypes`: the parameter is positional, not a property, so it
is allowed - but a property assignment of the same value is not. Do not silence
it with a cast.

- [ ] **Step 7: Commit**

```bash
git add apps/food-waste-backend/src/common/events/order.events.ts \
        apps/food-waste-backend/src/common/events/__tests__/order-completed-event.spec.ts \
        apps/food-waste-backend/src/orders/order.service.ts
git commit -m "feat(backend): carry establishmentId on OrderCompletedEvent"
```

---

### Task 2: Attribute donations to merchant, establishment and goal

Three fields, written once at donation time. `goalCategoryAtContribution` is
included now because it is impossible to reconstruct later:
`DonationPool.activeGoalCategory` rotates in place, so a lookup performed next
month returns the category active _now_, not the one active when the donation
was made. Capturing it at write time is the only way the item breakdown stays
historically honest.

**Files:**

- Modify:
  `apps/food-waste-backend/src/donations/schemas/user-donation.schema.ts`
- Modify:
  `apps/food-waste-backend/src/donations/interfaces/donation.interface.ts:27-39`
- Modify: `apps/food-waste-backend/src/donations/donations.service.ts:241-256`
- Modify:
  `apps/food-waste-backend/src/donations/listeners/order-events.listener.ts:74-100`
- Test:
  `apps/food-waste-backend/src/donations/__tests__/donation-attribution.spec.ts`
  (create)

**Interfaces:**

- Consumes: `OrderCompletedEvent.establishmentId` from Task 1.
- Produces: `UserDonation.merchantId: ObjectId`,
  `UserDonation.establishmentId: ObjectId`,
  `UserDonation.goalCategoryAtContribution: DonationGoalCategory`;
  `CreateDonationInput` gains `merchantId`, `establishmentId` (both required).

- [ ] **Step 1: Write the failing test**

```ts
// apps/food-waste-backend/src/donations/__tests__/donation-attribution.spec.ts
import { Types } from 'mongoose';

import { resolveEstablishmentId } from '../listeners/order-events.listener';

describe('resolveEstablishmentId', () => {
  const orderId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();

  it('uses the id on the event and does not touch the database', async () => {
    const lookup = jest.fn();

    const result = await resolveEstablishmentId(
      orderId.toString(),
      establishmentId.toString(),
      lookup,
    );

    expect(result?.toString()).toBe(establishmentId.toString());
    expect(lookup).not.toHaveBeenCalled();
  });

  it('falls back to an order lookup when the event predates the field', async () => {
    const lookup = jest.fn().mockResolvedValue({ establishmentId });

    const result = await resolveEstablishmentId(
      orderId.toString(),
      undefined,
      lookup,
    );

    expect(lookup).toHaveBeenCalledWith(orderId.toString());
    expect(result?.toString()).toBe(establishmentId.toString());
  });

  it('returns null rather than throwing when the order is gone', async () => {
    // A donation must never be lost because attribution could not be resolved.
    // The caller writes the donation with merchantId only and logs the gap.
    const lookup = jest.fn().mockResolvedValue(null);

    const result = await resolveEstablishmentId(
      orderId.toString(),
      undefined,
      lookup,
    );

    expect(result).toBeNull();
  });

  it('returns null rather than throwing when the lookup itself fails', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('mongo down'));

    await expect(
      resolveEstablishmentId(orderId.toString(), undefined, lookup),
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`pnpm --filter @foodwaste/backend exec jest src/donations/__tests__/donation-attribution.spec.ts --runInBand`
Expected: FAIL with "resolveEstablishmentId is not exported" or a module
resolution error.

- [ ] **Step 3: Add the three schema fields**

```ts
// apps/food-waste-backend/src/donations/schemas/user-donation.schema.ts
// Inside class UserDonation, after donationPoolId:

  /**
   * The merchant whose sale produced this contribution. Denormalized rather
   * than joined through the order: the merchant ledger is read on every
   * dashboard load, and a $lookup between user_donations and orders on that
   * path is the N+1-shaped cost .claude/rules/performance.md rule 7 forbids.
   */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  establishmentId?: Types.ObjectId;

  /**
   * The goal the pool was funding at the moment of contribution. Captured here
   * because DonationPool.activeGoalCategory rotates in place - reading it later
   * returns today's goal, not the one this money went to.
   */
  @Prop({ type: String, enum: DonationGoalCategory })
  goalCategoryAtContribution?: DonationGoalCategory;
```

Import `DonationGoalCategory` from `@foodwaste/shared` at the top of the file,
matching `donation-pool.schema.ts`.

Then the index, beside the existing ones at the bottom of the file:

```ts
UserDonationSchema.index({ merchantId: 1, contributedAt: -1 });
```

`establishmentId` and `goalCategoryAtContribution` are optional, not `required`,
and deliberately so: `required` is a write validator that does nothing for the
documents already stored, and both are unknown for pre-backfill records.
`merchantId` is `required` because every donation written from now on has one.

- [ ] **Step 4: Extend the input type and persist the fields**

```ts
// apps/food-waste-backend/src/donations/interfaces/donation.interface.ts
export interface CreateDonationInput {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  merchantId: Types.ObjectId;
  establishmentId?: Types.ObjectId;
  amount: number;
  moneySaved?: number;
  currency?: string;
  isAnonymous?: boolean;
  metadata?: {
    deviceInfo?: string;
    platform?: 'mobile' | 'web';
    sessionId?: string;
  };
}
```

```ts
// apps/food-waste-backend/src/donations/donations.service.ts
// In createDonation, inside `new this.userDonationModel({ ... })`, after donationPoolId:
        merchantId: input.merchantId,
        ...(input.establishmentId ? { establishmentId: input.establishmentId } : {}),
        goalCategoryAtContribution: pool.activeGoalCategory,
```

The conditional spread is required: `exactOptionalPropertyTypes` rejects
assigning `Types.ObjectId | undefined` to an optional property.

- [ ] **Step 5: Add the resolver and wire the listener**

```ts
// apps/food-waste-backend/src/donations/listeners/order-events.listener.ts
// Exported at module level so it is unit-testable without instantiating the listener.

type OrderEstablishmentLookup = (
  orderId: string,
) => Promise<{ establishmentId?: Types.ObjectId } | null>;

/**
 * The event gained establishmentId in the release that added merchant
 * attribution. Messages already in the RabbitMQ queue at deploy time do not
 * carry it, so fall back to one order read. Never throw: a donation that cannot
 * resolve its establishment is still a donation, and losing it to satisfy an
 * attribution field would be the worse bug.
 */
export async function resolveEstablishmentId(
  orderId: string,
  fromEvent: string | undefined,
  lookup: OrderEstablishmentLookup,
): Promise<Types.ObjectId | null> {
  if (fromEvent) {
    return new Types.ObjectId(fromEvent);
  }

  try {
    const order = await lookup(orderId);
    return order?.establishmentId
      ? new Types.ObjectId(order.establishmentId)
      : null;
  } catch {
    return null;
  }
}
```

In `processOrderDonation`, replace the `createDonation` call:

```ts
const establishmentId = await resolveEstablishmentId(
  event.orderId,
  event.establishmentId,
  async id =>
    await this.orderModel
      .findById(id)
      .select('establishmentId')
      .lean<{ establishmentId?: Types.ObjectId }>()
      .exec(),
);

if (!establishmentId) {
  this.logger.warn(
    `Donation for order ${event.orderId} has no establishment attribution`,
  );
}

await this.donationsService.createDonation({
  userId: new Types.ObjectId(event.userId),
  orderId: new Types.ObjectId(event.orderId),
  merchantId: new Types.ObjectId(event.merchantId),
  ...(establishmentId ? { establishmentId } : {}),
  amount: donationAmount,
  metadata: {
    platform: 'web',
  },
});
```

Inject the order model into the listener's constructor, following the injection
style already used in this module:

```ts
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
```

Register
`MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }])` in
`donations.module.ts` if it is not already imported there.

- [ ] **Step 6: Run test to verify it passes**

Run:
`pnpm --filter @foodwaste/backend exec jest src/donations/__tests__/donation-attribution.spec.ts --runInBand`
Expected: PASS, all four cases.

- [ ] **Step 7: Verify the index is declared and applied**

Run: `pnpm --filter @foodwaste/backend verify:indexes:strict` Expected: passes,
listing `merchantId_1_contributedAt_-1` on `user_donations`. Then:
`pnpm --filter @foodwaste/backend db:create-indexes`

- [ ] **Step 8: Commit**

```bash
git add apps/food-waste-backend/src/donations apps/food-waste-backend/src/common/events
git commit -m "feat(backend): attribute donations to merchant, establishment and active goal"
```

---

### Task 3: Fund ledger aggregation

Two pieces, and the pure one is written first because it carries all the
arithmetic: TND to funded items, per goal category.

**Files:**

- Create:
  `apps/food-waste-backend/src/sustainability/services/fund-ledger.service.ts`
- Create:
  `apps/food-waste-backend/src/sustainability/__tests__/fund-ledger.spec.ts`
- Modify: `apps/food-waste-backend/src/sustainability/dto/sustainability.dto.ts`
- Modify: `apps/food-waste-backend/src/sustainability/sustainability.module.ts`

**Interfaces:**

- Consumes: `UserDonation.merchantId`, `UserDonation.goalCategoryAtContribution`
  from Task 2; `DEFAULT_CATEGORY_PRICES` from
  `donations/interfaces/donation.interface.ts`.
- Produces:
  - `toFundedItems(amountByCategory: Record<string, number>): FundedItem[]`
  - `FundLedgerService.getFundLedger(merchantId: string, establishmentId?: string): Promise<FundLedgerResponse>`
  - `FundLedgerResponse = { totalTnd: number; currency: 'TND'; contributionCount: number; items: FundedItem[]; totalItems: number; firstContributionAt: string | null }`
  - `FundedItem = { category: DonationGoalCategory; count: number; amountTnd: number }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/food-waste-backend/src/sustainability/__tests__/fund-ledger.spec.ts
import { DonationGoalCategory } from '@foodwaste/shared';

import { toFundedItems } from '../services/fund-ledger.service';

describe('toFundedItems', () => {
  it('converts TND per category using that category price', () => {
    // TSHIRTS 10 TND, MEDICINE 5 TND per DEFAULT_CATEGORY_PRICES
    const items = toFundedItems({
      [DonationGoalCategory.TSHIRTS]: 35,
      [DonationGoalCategory.MEDICINE]: 12,
    });

    expect(items).toEqual([
      { category: DonationGoalCategory.TSHIRTS, count: 3, amountTnd: 35 },
      { category: DonationGoalCategory.MEDICINE, count: 2, amountTnd: 12 },
    ]);
  });

  it('floors partial items and never rounds up', () => {
    // 9.99 TND does not buy a 10 TND t-shirt. Showing "1" would be the
    // inflation the spec forbids.
    const items = toFundedItems({ [DonationGoalCategory.TSHIRTS]: 9.99 });

    expect(items[0]).toEqual({
      category: DonationGoalCategory.TSHIRTS,
      count: 0,
      amountTnd: 9.99,
    });
  });

  it('returns an empty array for a merchant with no contributions', () => {
    expect(toFundedItems({})).toEqual([]);
  });

  it('ignores a category that is not in the price table', () => {
    // Defensive: a goal category added to the enum but not priced would
    // otherwise divide by undefined and emit NaN onto a public page.
    const items = toFundedItems({ NOT_A_GOAL: 50 } as Record<string, number>);

    expect(items).toEqual([]);
  });

  it('keeps categories in GOAL_SEQUENCE order, not insertion order', () => {
    const items = toFundedItems({
      [DonationGoalCategory.MEDICINE]: 25,
      [DonationGoalCategory.TSHIRTS]: 25,
    });

    expect(items.map(i => i.category)).toEqual([
      DonationGoalCategory.TSHIRTS,
      DonationGoalCategory.MEDICINE,
    ]);
  });

  it('handles the pre-backfill category being absent', () => {
    // Donations written before goalCategoryAtContribution existed group under
    // a null key. They contribute TND but no item breakdown.
    const items = toFundedItems({ null: 40 } as Record<string, number>);

    expect(items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`pnpm --filter @foodwaste/backend exec jest src/sustainability/__tests__/fund-ledger.spec.ts --runInBand`
Expected: FAIL, `Cannot find module '../services/fund-ledger.service'`.

- [ ] **Step 3: Write the pure converter and the service**

```ts
// apps/food-waste-backend/src/sustainability/services/fund-ledger.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { DonationGoalCategory } from '@foodwaste/shared';

import { GOAL_SEQUENCE } from '../../donations/constants/goal-sequence.constant';
import { DEFAULT_CATEGORY_PRICES } from '../../donations/interfaces/donation.interface';
import {
  UserDonation,
  UserDonationDocument,
} from '../../donations/schemas/user-donation.schema';
import type { FundLedgerResponse, FundedItem } from '../dto/sustainability.dto';

/**
 * TND to funded items, per category, at that category's price.
 *
 * Always floors. A merchant whose sales funded 9.99 TND toward a 10 TND t-shirt
 * funded zero t-shirts, and rounding that to one is the inflation the spec
 * forbids. Categories are emitted in GOAL_SEQUENCE order so the UI is stable.
 */
export function toFundedItems(
  amountByCategory: Record<string, number>,
): FundedItem[] {
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

@Injectable()
export class FundLedgerService {
  constructor(
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
  ) {}

  async getFundLedger(
    merchantId: string,
    establishmentId?: string,
  ): Promise<FundLedgerResponse> {
    const match: Record<string, unknown> = {
      merchantId: new Types.ObjectId(merchantId),
    };
    if (establishmentId) {
      match['establishmentId'] = new Types.ObjectId(establishmentId);
    }

    const rows = await this.userDonationModel
      .aggregate<{
        _id: string | null;
        amount: number;
        count: number;
        first: Date;
      }>([
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

    const amountByCategory: Record<string, number> = {};
    let totalTnd = 0;
    let contributionCount = 0;
    let firstContributionAt: Date | null = null;

    for (const row of rows) {
      totalTnd += row.amount;
      contributionCount += row.count;
      if (row._id) {
        amountByCategory[row._id] =
          (amountByCategory[row._id] ?? 0) + row.amount;
      }
      if (
        row.first &&
        (!firstContributionAt || row.first < firstContributionAt)
      ) {
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
      firstContributionAt: firstContributionAt
        ? firstContributionAt.toISOString()
        : null,
    };
  }
}
```

- [ ] **Step 4: Add the response types**

```ts
// apps/food-waste-backend/src/sustainability/dto/sustainability.dto.ts
export interface FundedItem {
  category: DonationGoalCategory;
  count: number;
  amountTnd: number;
}

export interface FundLedgerResponse {
  totalTnd: number;
  currency: 'TND';
  contributionCount: number;
  items: FundedItem[];
  totalItems: number;
  firstContributionAt: string | null;
}
```

Import `DonationGoalCategory` from `@foodwaste/shared` in that file.

- [ ] **Step 5: Register the service**

In `sustainability.module.ts`, add `FundLedgerService` to `providers` and
`exports`, and add
`MongooseModule.forFeature([{ name: UserDonation.name, schema: UserDonationSchema }])`
to `imports` if the sustainability module does not already register it.

- [ ] **Step 6: Run test to verify it passes**

Run:
`pnpm --filter @foodwaste/backend exec jest src/sustainability/__tests__/fund-ledger.spec.ts --runInBand`
Expected: PASS, all six cases.

- [ ] **Step 7: Mutation-check the floor**

Temporarily change `Math.floor` to `Math.round` in `toFundedItems`, re-run the
suite, and confirm the "floors partial items" case fails. Put it back. A test
that passes against both is not testing the rule.

- [ ] **Step 8: Commit**

```bash
git add apps/food-waste-backend/src/sustainability
git commit -m "feat(backend): merchant fund ledger aggregation"
```

---

### Task 4: Backfill historical donation attribution

This is a **release gate**, not a follow-up. The ledger reads zero for every
existing merchant until it runs, and a merchant whose first impression is "0.000
TND" reads the feature as broken.

**Files:**

- Create:
  `apps/food-waste-backend/scripts/migrations/backfill-donation-merchant-attribution.ts`
- Modify: `apps/food-waste-backend/package.json` (two scripts)

**Interfaces:**

- Consumes: the schema fields from Task 2.
- Produces: nothing importable. Run as
  `pnpm --filter @foodwaste/backend migration:backfill-donation-attribution[:execute]`.

- [ ] **Step 1: Write the migration**

Follows the house pattern in
`scripts/migrations/backfill-subscription-expiry.ts`: dotenv, raw mongoose
connection, raw collection access, dry-run by default, `--execute` to write.

```ts
// apps/food-waste-backend/scripts/migrations/backfill-donation-merchant-attribution.ts
/**
 * =========================================
 * 💚 DONATION MERCHANT ATTRIBUTION BACKFILL
 * =========================================
 *
 * Purpose: give every historical UserDonation the merchantId and
 * establishmentId of the order that produced it, so the merchant fund ledger
 * shows real history on launch day rather than zero.
 *
 * Why it is a release gate: the ledger aggregates on merchantId. Without this,
 * every merchant who joined before the feature sees 0.000 TND and reads the
 * card as broken. A first impression of "broken" is not recoverable by running
 * the migration a week later.
 *
 * What it does NOT backfill: goalCategoryAtContribution. The pool rotates its
 * active goal in place, so the category a historical donation funded is not
 * recoverable from current state. Those donations contribute to the TND total
 * and are excluded from the item breakdown, which toFundedItems already handles
 * by ignoring the null group.
 *
 * Idempotent: only touches documents missing merchantId. Re-running is a no-op.
 *
 * Usage:
 *   pnpm migration:backfill-donation-attribution            # Dry run (preview)
 *   pnpm migration:backfill-donation-attribution:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DONATIONS = 'userdonations';
const ORDERS = 'orders';
const BATCH_SIZE = 500;

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

interface DonationRow {
  _id: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  merchantId?: mongoose.Types.ObjectId;
}

interface OrderRow {
  _id: mongoose.Types.ObjectId;
  merchantId?: mongoose.Types.ObjectId;
  establishmentId?: mongoose.Types.ObjectId;
}

async function run(): Promise<void> {
  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error(
      'DATABASE_URL is not set. Configure .env before running this migration.',
    );
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('No database handle after connecting.');
  }

  const donations = db.collection<DonationRow>(DONATIONS);
  const orders = db.collection<OrderRow>(ORDERS);

  const pending = await donations
    .find({ merchantId: { $exists: false } })
    .toArray();
  log(`${pending.length} donation(s) without merchant attribution`);

  if (pending.length === 0) {
    log('Nothing to do.');
    await conn.disconnect();
    return;
  }

  let updated = 0;
  let orphaned = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const orderIds = batch
      .map(d => d.orderId)
      .filter((id): id is mongoose.Types.ObjectId => !!id);

    // Batched $in read plus a Map, never one findById per donation.
    const orderDocs = await orders
      .find({ _id: { $in: orderIds } })
      .project<OrderRow>({ merchantId: 1, establishmentId: 1 })
      .toArray();
    const byId = new Map(orderDocs.map(o => [o._id.toString(), o]));

    const ops = [];
    for (const donation of batch) {
      const order = donation.orderId
        ? byId.get(donation.orderId.toString())
        : undefined;
      if (!order?.merchantId) {
        orphaned += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: donation._id },
          update: {
            $set: {
              merchantId: order.merchantId,
              ...(order.establishmentId
                ? { establishmentId: order.establishmentId }
                : {}),
            },
          },
        },
      });
    }

    if (ops.length > 0) {
      if (dryRun) {
        updated += ops.length;
      } else {
        const result = await donations.bulkWrite(ops);
        updated += result.modifiedCount;
      }
    }
  }

  log('');
  log(dryRun ? '--- DRY RUN, nothing written ---' : '--- EXECUTED ---');
  log(`attributed: ${updated}`);
  log(
    `orphaned (order missing or has no merchantId, left untouched): ${orphaned}`,
  );
  if (dryRun) {
    log('Re-run with --execute to write.');
  }

  await conn.disconnect();
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Register the scripts**

In `apps/food-waste-backend/package.json`, beside the other `migration:`
entries:

```json
    "migration:backfill-donation-attribution": "ts-node -r tsconfig-paths/register scripts/migrations/backfill-donation-merchant-attribution.ts",
    "migration:backfill-donation-attribution:execute": "ts-node -r tsconfig-paths/register scripts/migrations/backfill-donation-merchant-attribution.ts --execute",
```

- [ ] **Step 3: Verify the lockfile is untouched**

Run: `pnpm check:lockfile` Expected: passes. Adding a script does not change
dependencies, so the lockfile must not move. If it reports drift, something else
changed.

- [ ] **Step 4: Dry run against local data**

Run: `pnpm --filter @foodwaste/backend migration:backfill-donation-attribution`
Expected: prints a pending count and an attributed count, writes nothing. If
`orphaned` is non-zero, note the number - those are donations whose order was
hard-deleted, and they will contribute to no merchant's ledger.

- [ ] **Step 5: Execute, then verify idempotence**

Run:
`pnpm --filter @foodwaste/backend migration:backfill-donation-attribution:execute`
Then run the dry run again. Expected: the second run reports
`0 donation(s) without merchant attribution`. A migration that finds work on its
second pass is not idempotent and must not ship.

- [ ] **Step 6: Commit**

```bash
git add apps/food-waste-backend/scripts/migrations/backfill-donation-merchant-attribution.ts \
        apps/food-waste-backend/package.json
git commit -m "feat(backend): backfill donation merchant attribution"
```

---

### Task 5: Expose the ledger endpoint

The controller is guarded by `ProSubscriptionGuard` at class level. The ledger
must be available to **every** merchant, not only Pro, so this endpoint needs
`@SkipProGuard()`. Getting this wrong hides the feature from most of the
merchant base and the failure is silent.

**Files:**

- Modify:
  `apps/food-waste-backend/src/sustainability/controllers/sustainability.controller.ts`

**Interfaces:**

- Consumes: `FundLedgerService.getFundLedger` from Task 3.
- Produces: `GET /api/v1/sustainability/fund-ledger?establishmentId=` returning
  `{ message, data: FundLedgerResponse }`.

- [ ] **Step 1: Add the endpoint**

```ts
  @Get('fund-ledger')
  @SkipProGuard()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Community fund contribution generated by this merchant's sales" })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Fund ledger retrieved' })
  async getFundLedger(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: FundLedgerResponse }> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.fundLedgerService.getFundLedger(
      req.user.userId,
      effectiveEstablishmentId,
    );
    return { message: 'Fund ledger retrieved successfully', data };
  }
```

Inject `private readonly fundLedgerService: FundLedgerService` into the
constructor and import `FundLedgerService` plus the `FundLedgerResponse` type.

The `LOCATION_MANAGER` branch is copied deliberately from `getEsgTier` in the
same file: a location manager may only ever see their assigned establishment,
and omitting the branch would let them read the whole organisation's ledger by
passing any id.

- [ ] **Step 2: Verify the guard actually skips**

Run the backend (`pnpm --filter @foodwaste/backend dev`), log in as a merchant
on a **trial or standard** subscription, and call:

```bash
curl -i --cookie "<session cookies>" http://localhost:3000/api/v1/sustainability/fund-ledger
```

Expected: `200` with a ledger payload. A `403` means `@SkipProGuard()` is
missing or the decorator import is wrong.

- [ ] **Step 3: Confirm merchant scoping**

Call the same endpoint as a **different** merchant and confirm the totals differ
and that neither sees the other's contributions. The aggregation matches on
`req.user.userId`, so a payload that changes when `establishmentId` is spoofed
is a bug.

- [ ] **Step 4: Full backend gate**

Run: `pnpm --filter @foodwaste/backend check:all` Expected: ts, lint, format,
tests and docs all clean.

- [ ] **Step 5: Commit**

```bash
git add apps/food-waste-backend/src/sustainability/controllers/sustainability.controller.ts
git commit -m "feat(backend): expose merchant fund ledger endpoint"
```

---

### Task 6: Web data layer

**Files:**

- Modify: `apps/web/src/types/dashboard.ts`
- Modify: `apps/web/src/services/dashboard.service.ts`
- Modify: `apps/web/src/hooks/use-merchant-dashboard.ts`

**Interfaces:**

- Consumes: `GET /sustainability/fund-ledger` from Task 5.
- Produces: `useFundLedger()` returning
  `{ data: FundLedgerResponse | undefined, isLoading, isError }`;
  `dashboardKeys.fundLedger(establishmentId?)`.

- [ ] **Step 1: Add the types**

```ts
// apps/web/src/types/dashboard.ts
export type DonationGoalCategory =
  | 'TSHIRTS'
  | 'PANTS'
  | 'SHOES'
  | 'CHILDREN_STUDIES'
  | 'MEDICINE';

export interface FundedItem {
  category: DonationGoalCategory;
  count: number;
  amountTnd: number;
}

export interface FundLedgerResponse {
  totalTnd: number;
  currency: 'TND';
  contributionCount: number;
  items: FundedItem[];
  totalItems: number;
  firstContributionAt: string | null;
}
```

- [ ] **Step 2: Add the service call**

```ts
// apps/web/src/services/dashboard.service.ts, in the sustainability block
  getFundLedger(establishmentId?: string) {
    return apiClient.get<BackendEnvelope<FundLedgerResponse>>(
      `${SUSTAINABILITY_BASE}/fund-ledger`,
      {
        params: {
          ...(establishmentId ? { establishmentId } : {}),
        },
      },
    );
  },
```

- [ ] **Step 3: Add the query key and hook**

```ts
// apps/web/src/hooks/use-merchant-dashboard.ts

// In the dashboardKeys factory, beside esgTier:
  fundLedger: (establishmentId?: string) =>
    ['dashboard', 'fund-ledger', establishmentId ?? 'all'] as const,

// With the other sustainability hooks:
export function useFundLedger() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.fundLedger(estId ?? undefined),
    queryFn: async (): Promise<FundLedgerResponse> => {
      const response = await dashboardService.getFundLedger(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

`staleTime` matches `useEsgTier`: the ledger changes only when an order
completes, so refetching on every focus returns what the client already has.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @foodwaste/web type-check` Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types/dashboard.ts apps/web/src/services/dashboard.service.ts \
        apps/web/src/hooks/use-merchant-dashboard.ts
git commit -m "feat(web): fund ledger query hook"
```

---

### Task 7: Fund ledger card

**Files:**

- Create: `apps/web/src/components/dashboard/merchant/fund-ledger-card.tsx`
- Create:
  `apps/web/src/components/dashboard/merchant/__tests__/fund-ledger-card.test.tsx`
- Modify: `apps/web/src/components/dashboard/merchant/index.ts`
- Modify: `apps/web/src/app/[locale]/(merchant)/merchant/dashboard/page.tsx`
- Modify: `apps/web/src/messages/en.json`, `fr.json`, `ar.json`
- Modify: the `(merchant)` layout's namespace array

**Interfaces:**

- Consumes: `useFundLedger()` from Task 6.
- Produces: `<FundLedgerCard />`, no props.

- [ ] **Step 1: Add translations to all three locales**

Under `dashboard`, key `fundLedger`. English:

```json
    "fundLedger": {
      "title": "Community fund",
      "subtitle": "Funded by your sales, from our platform fee",
      "totalLabel": "contributed so far",
      "itemsLabel": "items funded",
      "since": "since {date}",
      "empty": "Your first sale starts this",
      "emptyHint": "Every order you fulfil sends part of our platform fee to the community fund.",
      "error": "We could not load your community fund right now.",
      "categories": {
        "TSHIRTS": "t-shirts",
        "PANTS": "trousers",
        "SHOES": "shoes",
        "CHILDREN_STUDIES": "school kits",
        "MEDICINE": "medicine packs"
      }
    }
```

French and Arabic get the same key set. The subtitle must not translate as "you
donated" in any locale - the merchant did not give their own money, and a
merchant repeating that publicly is a false claim we handed them. French:
`"Financé par vos ventes, sur notre commission"`. Arabic:
`"مموَّل من مبيعاتك، من عمولتنا"`.

- [ ] **Step 2: Register the namespace**

Add `'dashboard.fundLedger'` to the `*_NAMESPACES` array in the `(merchant)`
layout, or the keys render as literal `dashboard.fundLedger.title` strings on
the client. Nothing type-checks this - it is caught only by looking at the page.

- [ ] **Step 3: Write the failing test**

```tsx
// apps/web/src/components/dashboard/merchant/__tests__/fund-ledger-card.test.tsx
import { render, screen } from '@testing-library/react';

import { FundLedgerCard } from '../fund-ledger-card';
import { useFundLedger } from '@/hooks/use-merchant-dashboard';

jest.mock('@/hooks/use-merchant-dashboard');
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const mockUseFundLedger = useFundLedger as jest.MockedFunction<
  typeof useFundLedger
>;

function mockState(overrides: Partial<ReturnType<typeof useFundLedger>>) {
  mockUseFundLedger.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useFundLedger>);
}

describe('FundLedgerCard', () => {
  it('renders a skeleton while loading', () => {
    mockState({ isLoading: true });
    const { container } = render(<FundLedgerCard />);
    expect(
      container.querySelector('[data-testid="fund-ledger-skeleton"]'),
    ).toBeInTheDocument();
  });

  it('renders a translated error message, never a status code', () => {
    mockState({ isError: true });
    render(<FundLedgerCard />);
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('renders the empty state for a merchant with no contributions', () => {
    mockState({
      data: {
        totalTnd: 0,
        currency: 'TND',
        contributionCount: 0,
        items: [],
        totalItems: 0,
        firstContributionAt: null,
      },
    });
    render(<FundLedgerCard />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('shows the exact total and the funded item breakdown', () => {
    mockState({
      data: {
        totalTnd: 47.35,
        currency: 'TND',
        contributionCount: 12,
        items: [
          { category: 'TSHIRTS', count: 3, amountTnd: 35 },
          { category: 'MEDICINE', count: 2, amountTnd: 12.35 },
        ],
        totalItems: 5,
        firstContributionAt: '2026-03-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    expect(screen.getByText(/47\.35/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText('categories.TSHIRTS')).toBeInTheDocument();
  });

  it('hides a category that funded zero whole items', () => {
    // 4 TND toward a 10 TND t-shirt is real money but zero t-shirts. Showing
    // "0 t-shirts" reads as failure; the TND total still carries it.
    mockState({
      data: {
        totalTnd: 4,
        currency: 'TND',
        contributionCount: 1,
        items: [{ category: 'TSHIRTS', count: 0, amountTnd: 4 }],
        totalItems: 0,
        firstContributionAt: '2026-08-01T00:00:00.000Z',
      },
    });
    render(<FundLedgerCard />);

    expect(screen.queryByText('categories.TSHIRTS')).not.toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @foodwaste/web test fund-ledger-card` Expected: FAIL, cannot
resolve `../fund-ledger-card`.

- [ ] **Step 5: Write the component**

Tokens only, per `DESIGN.md`: no raw hex, named spacing scale, and the
glass/rounded/shadow treatment already used by `streak-widget.tsx` so the card
does not read as a different product.

```tsx
// apps/web/src/components/dashboard/merchant/fund-ledger-card.tsx
'use client';

import { HeartHandshake } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useFundLedger } from '@/hooks/use-merchant-dashboard';

export function FundLedgerCard() {
  const t = useTranslations('dashboard.fundLedger');
  const { data, isLoading, isError } = useFundLedger();

  if (isLoading) {
    return (
      <div
        data-testid='fund-ledger-skeleton'
        className='glass rounded-2xl shadow-soft h-[140px] animate-pulse bg-white/30'
      />
    );
  }

  if (isError) {
    return (
      <div className='glass rounded-2xl shadow-soft p-lg'>
        <p className='text-sm text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  if (!data || data.contributionCount === 0) {
    return (
      <div className='glass rounded-2xl shadow-soft p-lg flex flex-col items-center text-center gap-sm'>
        <HeartHandshake size={32} className='text-primary-500/40' />
        <h3 className='font-display text-md text-primary-500'>{t('empty')}</h3>
        <p className='text-xs text-primary-500/65 max-w-xs'>{t('emptyHint')}</p>
      </div>
    );
  }

  // A category that funded money but no whole item is carried by the TND total.
  // Rendering "0 school kits" reads as failure for a real contribution.
  const fundedItems = data.items.filter(item => item.count > 0);

  return (
    <div className='glass rounded-2xl shadow-soft p-lg'>
      <div className='flex items-center gap-sm mb-md'>
        <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 shrink-0'>
          <HeartHandshake size={18} />
        </div>
        <div className='min-w-0'>
          <div className='font-display text-lg text-primary-500 leading-tight'>
            {t('title')}
          </div>
          <p className='text-xs text-primary-500/65 mt-xxs'>{t('subtitle')}</p>
        </div>
      </div>

      <div className='flex items-baseline gap-xs'>
        <span className='font-display text-4xl text-primary-500 tracking-tight'>
          {data.totalTnd.toFixed(3)}
        </span>
        <span className='text-sm text-primary-500/60 font-medium'>
          {data.currency}
        </span>
      </div>
      <p className='text-xs text-primary-500/50 mt-xxs'>{t('totalLabel')}</p>

      {fundedItems.length > 0 && (
        <ul className='mt-md flex flex-wrap gap-sm'>
          {fundedItems.map(item => (
            <li
              key={item.category}
              className='rounded-full bg-primary-500/[0.06] px-md py-xs text-xs text-primary-500'
            >
              <span className='font-semibold'>{item.count}</span>{' '}
              {t(`categories.${item.category}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @foodwaste/web test fund-ledger-card` Expected: PASS, all
five cases.

- [ ] **Step 7: Mount it on the dashboard**

Export from `components/dashboard/merchant/index.ts` and render
`<FundLedgerCard />` in the merchant dashboard page, in the same grid as the
existing impact cards.

- [ ] **Step 8: Check all three locales by eye**

Run `pnpm --filter @foodwaste/web dev`, then open `/en/merchant/dashboard`,
`/fr/merchant/dashboard` and `/ar/merchant/dashboard`. In Arabic confirm the
card mirrors: the icon sits on the right, the number reads correctly, and
nothing overflows. Raw `dashboard.fundLedger.title` text anywhere means Step 2
was missed.

- [ ] **Step 9: Design and type gates**

Run: `pnpm --filter @foodwaste/web check:design` Run:
`pnpm --filter @foodwaste/web type-check && pnpm --filter @foodwaste/web test`
Expected: all clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/dashboard/merchant apps/web/src/messages \
        "apps/web/src/app/[locale]/(merchant)"
git commit -m "feat(web): community fund ledger card on merchant dashboard"
```

---

## Done criteria

- A merchant who joined before this shipped opens the dashboard and sees their
  real historical contribution, not zero.
- A merchant with no completed orders sees a real empty state, not `0.000 TND`.
- A trial or standard-tier merchant can read the endpoint. Pro is not required.
- Two merchants never see each other's figures, and a location manager sees only
  their assigned establishment.
- No copy in any locale says the merchant donated their own money.
- The backfill migration is idempotent and reports zero pending on a second run.

## Deliberately not in this plan

- `publicSlug`, `foundingPartnerAt`, customers served, testimonials, and the
  public profile - sibling plan 2.
- Impact snapshots, share cards, OG routes and the window sticker - sibling
  plan 3.
- Mobile. The ledger is web-dashboard only in P0.
