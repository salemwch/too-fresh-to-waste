/**
 * Collapse duplicate ACTIVE donation pools down to one.
 *
 *   pnpm --filter @foodwaste/backend migrate:dedupe-donation-pools
 *   pnpm --filter @foodwaste/backend migrate:dedupe-donation-pools -- --apply
 *
 * Dry run by default. Prints what it would do and changes nothing.
 *
 * Why this exists: `initializeDefaultPool()` used to read-then-create, and the
 * backend runs PM2 in cluster mode, so every worker raced to create the default
 * pool at startup — one ACTIVE pool per worker. The fix is a unique partial
 * index (`uniq_single_active_pool`), but that index **cannot build** while
 * duplicates exist, so this has to run first.
 *
 * Merge rules, in order of what matters:
 *   1. Keep the pool with the most money in it. Contributions were split
 *      arbitrarily by `getActivePool()`, so the largest is the one most
 *      referenced by UserDonation rows.
 *   2. Ties break toward the oldest, which is the one most likely to be
 *      referenced by anything holding an id.
 *   3. Sum `currentAmount` and `mealCount` from the losers into the keeper.
 *      The money was really donated; dropping it would understate the charity
 *      ledger, which is public.
 *   4. Losers are archived, never deleted — they are referenced by
 *      `UserDonation.donationPoolId`, and deleting them would orphan those rows
 *      and break donation history.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';

import { AppModule } from '../../src/app.module';
import { DonationPool, DonationPoolStatus } from '../../src/donations/schemas/donation-pool.schema';
import { UserDonation } from '../../src/donations/schemas/user-donation.schema';

interface PoolRow {
  _id: Types.ObjectId;
  currentAmount: number;
  mealCount: number;
  contributorCount: number;
  createdAt: Date;
  activeGoalCategory: string;
  season: number;
}

async function bootstrap(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  const poolModel = app.get<Model<DonationPool>>(getModelToken(DonationPool.name));
  const donationModel = app.get<Model<UserDonation>>(getModelToken(UserDonation.name));

  try {
    const active = (await poolModel
      .find({ status: DonationPoolStatus.ACTIVE, isArchived: false })
      .sort({ currentAmount: -1, createdAt: 1 })
      .lean()) as unknown as PoolRow[];

    if (active.length <= 1) {
      process.stdout.write(
        `Nothing to do: ${active.length} active pool(s). The unique index can build safely.\n`,
      );
      return;
    }

    // Duplicates only make sense to merge within one season and goal. Anything
    // else is not this bug and must not be silently combined.
    const distinct = new Set(active.map(p => `${p.season}:${p.activeGoalCategory}`));
    if (distinct.size > 1) {
      throw new Error(
        `Active pools span multiple season/goal combinations (${[...distinct].join(', ')}). ` +
          'That is not the startup race this migration handles — resolve by hand.',
      );
    }

    const [keeper, ...losers] = active as [PoolRow, ...PoolRow[]];

    const mergedAmount = losers.reduce((sum, p) => sum + (p.currentAmount ?? 0), 0);
    const mergedMeals = losers.reduce((sum, p) => sum + (p.mealCount ?? 0), 0);

    const loserIds = losers.map(p => p._id);
    const affectedDonations = await donationModel.countDocuments({
      donationPoolId: { $in: loserIds },
    });

    process.stdout.write(
      `\nFound ${active.length} ACTIVE pools for season ${keeper.season} / ` +
        `${keeper.activeGoalCategory}.\n\n` +
        `  keep    ${String(keeper._id)}  ${keeper.currentAmount.toFixed(3)} TND ` +
        `(created ${keeper.createdAt.toISOString()})\n` +
        losers
          .map(
            p =>
              `  archive ${String(p._id)}  ${p.currentAmount.toFixed(3)} TND ` +
              `(created ${p.createdAt.toISOString()})`,
          )
          .join('\n') +
        `\n\n  merging ${mergedAmount.toFixed(3)} TND and ${mergedMeals} meals into the keeper\n` +
        `  ${affectedDonations} UserDonation row(s) point at archived pools ` +
        `(left intact — history must stay readable)\n`,
    );

    if (!apply) {
      process.stdout.write('\nDry run. Re-run with --apply to make these changes.\n');
      return;
    }

    await poolModel.updateOne(
      { _id: keeper._id },
      { $inc: { currentAmount: mergedAmount, mealCount: mergedMeals } },
    );

    await poolModel.updateMany(
      { _id: { $in: loserIds } },
      {
        $set: {
          status: DonationPoolStatus.ARCHIVED,
          isArchived: true,
          archivedAt: new Date(),
        },
      },
    );

    process.stdout.write(
      `\nDone. One ACTIVE pool remains (${String(keeper._id)}).\n` +
        'Now create the index: pnpm --filter @foodwaste/backend db:create-indexes\n',
    );
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => {
    // Bull queues and the Redis client keep handles open that app.close() does
    // not drain, so the process would otherwise sit there after finishing its
    // work — indistinguishable from a hang, and fatal in CI.
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`Migration failed: ${(error as Error).message}\n`);
    process.exit(1);
  });
