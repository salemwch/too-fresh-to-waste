import { WaitlistEmail } from '@foodwaste/email-templates';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { render } from '@react-email/render';
import { Model } from 'mongoose';
import * as React from 'react';

import { EmailService } from '../email/email.service';

import {
  WaitlistAudience,
  WaitlistEntry,
  WaitlistEntryDocument,
} from './schemas/waitlist-entry.schema';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectModel(WaitlistEntry.name)
    private readonly waitlistModel: Model<WaitlistEntryDocument>,
    private readonly emailService: EmailService,
  ) {}

  /** The global launch list — no city attached. */
  async subscribe(email: string): Promise<void> {
    const normalised = email.toLowerCase().trim();

    // Scoped to rows with no zone: a city sign-up must not be mistaken for a
    // global one, or the launch email would never be sent.
    const existing = await this.waitlistModel
      .findOne({ email: normalised, zone: { $exists: false } })
      .lean()
      .exec();
    if (existing) {
      this.logger.debug(`Waitlist: ${normalised} already registered — skipping`);
      return;
    }

    await this.waitlistModel.create({ email: normalised });
    this.logger.log(`Waitlist: new subscriber ${normalised}`);

    // Fire-and-forget — failure does not affect the 200 response
    this.sendConfirmation(normalised).catch(err =>
      this.logger.error(`Waitlist confirmation email failed for ${normalised}:`, err),
    );
  }

  /**
   * Adds someone to one city list.
   *
   * Signing up twice is the ordinary case — a shared link gets clicked again —
   * so the duplicate key is absorbed as success. Telling a visitor they are
   * already on the list leaks that the address is registered and gives them
   * nothing to act on.
   */
  async joinCity(email: string, zone: string, audience: WaitlistAudience): Promise<void> {
    const normalised = email.toLowerCase().trim();

    await this.waitlistModel
      .updateOne(
        { email: normalised, zone: zone.trim() },
        { $setOnInsert: { audience, source: 'rollout_map' } },
        { upsert: true },
      )
      .exec();
  }

  /** How many people are waiting, per city. Powers the public demand ranking. */
  async countByZone(): Promise<Map<string, number>> {
    const rows = await this.waitlistModel
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: { zone: { $exists: true, $ne: null } } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(rows.map(row => [row._id, row.count]));
  }

  /** Total rows across every list, for the public impact figure. */
  async totalWaiting(): Promise<number> {
    const total = await this.waitlistModel.estimatedDocumentCount().exec();
    return total;
  }

  private async sendConfirmation(email: string): Promise<void> {
    const html = await render(React.createElement(WaitlistEmail, { email }));
    const text = [
      "You're on the list! 🚀",
      '',
      'Thank you for signing up for the Too Fresh To Waste launch list.',
      '',
      'Launch date: June 6, 2026',
      "You'll receive an email the moment the app is live.",
      '',
      'The Too Fresh To Waste Team',
    ].join('\n');

    await this.emailService.sendEmail({
      to: email,
      subject: "You're on the launch list! 🚀 Too Fresh To Waste",
      html,
      text,
    });
  }
}
