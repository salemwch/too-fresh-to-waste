import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from '../../users/schemas/user.schema';
import type { StreakResponse } from '../dto/sustainability.dto';

const TUNIS_TZ = 'Africa/Tunis';
const MAX_FREEZES = 3;
const FREEZE_EVERY_N_DAYS = 7;

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  private getTodayTunis(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: TUNIS_TZ });
  }

  private getYesterdayTunis(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: TUNIS_TZ });
  }

  private getCurrentHourTunis(): number {
    return parseInt(
      new Date()
        .toLocaleTimeString('en-GB', { timeZone: TUNIS_TZ, hour: '2-digit' })
        .split(':')[0]!,
      10,
    );
  }

  /**
   * Called every time a merchant creates a new offer.
   * Increments or starts the streak for the calendar day in Africa/Tunis TZ.
   * Awards 1 freeze (up to MAX_FREEZES) for every FREEZE_EVERY_N_DAYS consecutive days.
   */
  async recordListing(merchantId: string): Promise<void> {
    const today = this.getTodayTunis();
    const yesterday = this.getYesterdayTunis();

    const user = await this.userModel
      .findById(new Types.ObjectId(merchantId))
      .select('listingStreak longestStreak lastListedDate streakFreezeCount')
      .exec();

    if (!user) {
      return;
    }

    const last = user.lastListedDate ?? null;

    // Already recorded today — idempotent
    if (last === today) {
      return;
    }

    let streak = user.listingStreak ?? 0;

    if (last === yesterday) {
      streak += 1;
    } else {
      // Gap (cron handles freeze consumption before this point)
      streak = 1;
    }

    const longest = Math.max(user.longestStreak ?? 0, streak);

    // Award freeze at every FREEZE_EVERY_N_DAYS milestone
    let freezes = user.streakFreezeCount ?? 0;
    if (streak % FREEZE_EVERY_N_DAYS === 0 && freezes < MAX_FREEZES) {
      freezes = Math.min(freezes + 1, MAX_FREEZES);
      this.logger.log(`Streak freeze awarded to merchant ${merchantId} at day ${streak}`);
    }

    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(merchantId) },
        {
          $set: {
            listingStreak: streak,
            longestStreak: longest,
            lastListedDate: today,
            streakFreezeCount: freezes,
          },
        },
      )
      .exec();
  }

  /**
   * Runs at 00:01 Africa/Tunis every night.
   * Merchants who didn't list yesterday: consume a freeze (streak survives) or reset to 0.
   */
  @Cron('1 0 * * *', { timeZone: TUNIS_TZ })
  async processNightlyBreaks(): Promise<void> {
    const yesterday = this.getYesterdayTunis();

    this.logger.log(`Processing nightly streak breaks. Yesterday: ${yesterday}`);

    // Merchants with an active streak who did NOT list yesterday
    const atRisk = await this.userModel
      .find({
        listingStreak: { $gt: 0 },
        $or: [{ lastListedDate: { $lt: yesterday } }, { lastListedDate: null }],
      })
      .select('_id listingStreak streakFreezeCount')
      .exec();

    if (atRisk.length === 0) {
      return;
    }

    const withFreeze = atRisk.filter(u => (u.streakFreezeCount ?? 0) > 0).map(u => u._id);
    const withoutFreeze = atRisk.filter(u => (u.streakFreezeCount ?? 0) === 0).map(u => u._id);

    if (withFreeze.length > 0) {
      await this.userModel
        .updateMany(
          { _id: { $in: withFreeze } },
          {
            $inc: { streakFreezeCount: -1 },
            $set: { lastListedDate: yesterday }, // treat yesterday as "covered" so next listing extends chain
          },
        )
        .exec();
      this.logger.log(`Streak freeze consumed for ${withFreeze.length} merchant(s)`);
    }

    if (withoutFreeze.length > 0) {
      await this.userModel
        .updateMany({ _id: { $in: withoutFreeze } }, { $set: { listingStreak: 0 } })
        .exec();
      this.logger.log(`Streak reset for ${withoutFreeze.length} merchant(s)`);
    }
  }

  async getStreakData(merchantId: string): Promise<StreakResponse> {
    const user = await this.userModel
      .findById(new Types.ObjectId(merchantId))
      .select('listingStreak longestStreak lastListedDate streakFreezeCount')
      .exec();

    const currentStreak = user?.listingStreak ?? 0;
    const longestStreak = user?.longestStreak ?? 0;
    const freezesAvailable = user?.streakFreezeCount ?? 0;
    const lastListedDate = user?.lastListedDate ?? null;

    const today = this.getTodayTunis();
    const listedToday = lastListedDate === today;
    const hourTunis = this.getCurrentHourTunis();
    const streakAtRisk = !listedToday && hourTunis >= 18;

    // Days until next freeze: distance to next multiple of FREEZE_EVERY_N_DAYS
    const nextFreezeAt =
      freezesAvailable >= MAX_FREEZES
        ? 0
        : FREEZE_EVERY_N_DAYS - (currentStreak % FREEZE_EVERY_N_DAYS);

    return {
      currentStreak,
      longestStreak,
      freezesAvailable,
      lastListedDate,
      streakAtRisk,
      listedToday,
      nextFreezeAt,
    };
  }
}
