import { WaitlistEmail } from '@foodwaste/email-templates';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { render } from '@react-email/render';
import { Model } from 'mongoose';
import * as React from 'react';

import { EmailService } from '../email/email.service';

import { WaitlistEntry, WaitlistEntryDocument } from './schemas/waitlist-entry.schema';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectModel(WaitlistEntry.name)
    private readonly waitlistModel: Model<WaitlistEntryDocument>,
    private readonly emailService: EmailService,
  ) {}

  async subscribe(email: string): Promise<void> {
    const normalised = email.toLowerCase().trim();

    const existing = await this.waitlistModel.findOne({ email: normalised }).lean().exec();
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
