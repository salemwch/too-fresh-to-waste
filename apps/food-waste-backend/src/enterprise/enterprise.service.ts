import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EmailService } from '../email/email.service';

import { CreateEnterpriseInquiryDto } from './dto/create-enterprise-inquiry.dto';
import { EnterpriseInquiry, EnterpriseInquiryDocument } from './schemas/enterprise-inquiry.schema';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);
  private readonly notifyEmail =
    process.env['ENTERPRISE_NOTIFY_EMAIL'] ?? 'support@toofreshtowaste.com';

  constructor(
    @InjectModel(EnterpriseInquiry.name)
    private readonly inquiryModel: Model<EnterpriseInquiryDocument>,
    private readonly emailService: EmailService,
  ) {}

  async createInquiry(dto: CreateEnterpriseInquiryDto): Promise<void> {
    await this.inquiryModel.create(dto);
    this.logger.log(`Enterprise inquiry from ${dto.email} (${dto.companyName})`);

    this.sendNotification(dto).catch(err =>
      this.logger.error(`Enterprise notification email failed for ${dto.email}:`, err),
    );
  }

  private async sendNotification(dto: CreateEnterpriseInquiryDto): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f9f3f0;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#1E4448;padding:28px 32px;">
            <p style="color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 6px;">Too Fresh To Waste</p>
            <h1 style="color:#fff;font-size:22px;margin:0;">New Enterprise Inquiry</h1>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#666;width:140px;">Company</td><td style="padding:8px 0;font-weight:600;color:#1E4448;">${dto.companyName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Name</td><td style="padding:8px 0;font-weight:600;color:#1E4448;">${dto.firstName} ${dto.lastName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${dto.email}" style="color:#F55449;">${dto.email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;font-weight:600;color:#1E4448;">${dto.phone}</td></tr>
              ${
                dto.message
                  ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;">Message</td><td style="padding:8px 0;color:#444;">${dto.message}</td></tr>`
                  : ''
              }
            </table>
            <div style="margin-top:24px;padding:16px;background:#f9f3f0;border-radius:8px;">
              <p style="margin:0;font-size:13px;color:#888;">Reply directly to <a href="mailto:${dto.email}" style="color:#F55449;">${dto.email}</a> or call <strong>${dto.phone}</strong> to follow up within 24 hours.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = [
      'New Enterprise Inquiry — Too Fresh To Waste',
      '',
      `Company: ${dto.companyName}`,
      `Name: ${dto.firstName} ${dto.lastName}`,
      `Email: ${dto.email}`,
      `Phone: ${dto.phone}`,
      dto.message ? `Message: ${dto.message}` : '',
      '',
      'Reply within 24 hours.',
    ]
      .filter(Boolean)
      .join('\n');

    await this.emailService.sendEmail({
      to: this.notifyEmail,
      subject: `New enterprise inquiry — ${dto.companyName}`,
      html,
      text,
    });
  }
}
