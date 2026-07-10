import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosInstance } from 'axios';

import { INotificationProvider, NotificationResult } from '../interfaces/notification.interfaces';
import { NotificationPreference } from '../schemas/notification-preference.schema';
import { NotificationTarget, NotificationPayload } from '../types/notification.types';

import type Mail from 'nodemailer/lib/mailer';

@Injectable()
export class EmailNotificationService implements INotificationProvider {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly resendClient: AxiosInstance;
  private readonly resendApiUrl = 'https://api.resend.com/emails';

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreference>,
    private readonly configService: ConfigService,
  ) {
    void this.preferencesModel;

    const apiKey = this.getRequiredConfigValue('RESEND_API_KEY');
    this.resendClient = axios.create({
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    this.logger.log('Resend notification email service initialized');
  }

  private getNonEmptyConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private getRequiredConfigValue(key: string): string {
    const value = this.getNonEmptyConfigValue(key);
    if (!value) {
      throw new Error(`${key} is required for Resend email delivery`);
    }
    return value;
  }

  async send(
    payload: NotificationPayload,
    target: NotificationTarget,
  ): Promise<NotificationResult> {
    try {
      const emailAddress = this.getEmailAddress(target);

      if (!emailAddress) {
        return {
          success: false,
          error: 'No email address found for target',
        };
      }

      return await this.sendViaResend({
        to: [emailAddress],
        subject: payload.title,
        html: this.buildHtmlBody(payload),
        text: payload.body,
      });
    } catch (error) {
      this.logger.error(
        `Email notification failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBulk(
    payload: NotificationPayload,
    targets: NotificationTarget[],
  ): Promise<NotificationResult[]> {
    const emailPromises = targets.map(async target => {
      try {
        return await this.send(payload, target);
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    });

    const result = await Promise.all(emailPromises);
    return result;
  }

  async sendTemplateEmail(
    templateData: {
      subject: string;
      htmlBody: string;
      textBody?: string;
    },
    target: NotificationTarget,
    options?: {
      from?: string;
      replyTo?: string;
      attachments?: Mail.Attachment[];
    },
  ): Promise<NotificationResult> {
    try {
      const emailAddress = this.getEmailAddress(target);

      if (!emailAddress) {
        return {
          success: false,
          error: 'No email address found for target',
        };
      }

      const from = options?.from ?? this.getDefaultFromAddress();
      const attachments = this.mapAttachments(options?.attachments ?? []);

      const result = await this.sendViaResend({
        from,
        to: [emailAddress],
        subject: templateData.subject,
        html: templateData.htmlBody,
        text: templateData.textBody ?? this.stripHtml(templateData.htmlBody),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Template email failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendTransactionalEmail(
    type: 'order_confirmation' | 'pickup_reminder' | 'password_reset' | 'welcome',
    data: Record<string, unknown>,
    target: NotificationTarget,
  ): Promise<NotificationResult> {
    const templates = {
      order_confirmation: {
        subject: 'Order Confirmation - Too Fresh To Waste',
        htmlBody: this.getOrderConfirmationTemplate(data),
      },
      pickup_reminder: {
        subject: 'Pickup Reminder - Your order is ready!',
        htmlBody: this.getPickupReminderTemplate(data),
      },
      password_reset: {
        subject: 'Password Reset - Too Fresh To Waste',
        htmlBody: this.getPasswordResetTemplate(data),
      },
      welcome: {
        subject: 'Welcome to Too Fresh To Waste!',
        htmlBody: this.getWelcomeTemplate(data),
      },
    };

    const template = templates[type];
    if (template === null || template === undefined) {
      return { success: false, error: `Unknown email template type: ${type}` };
    }

    const result = await this.sendTemplateEmail(template, target);
    return result;
  }

  private async sendViaResend(payload: {
    from?: string;
    to: string[];
    reply_to?: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{ filename: string; content: string }>;
  }): Promise<NotificationResult> {
    try {
      const from = payload.from ?? this.getDefaultFromAddress();

      const response = await this.resendClient.post<{ id?: string }>(this.resendApiUrl, {
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
        ...(payload.attachments ? { attachments: payload.attachments } : {}),
        headers: {
          'X-Mailer': 'TooFreshToWaste-Platform',
          'Idempotency-Key': randomUUID(),
        },
      });

      const messageId = response.data.id ?? 'unknown';

      return {
        success: true,
        messageId,
        deliveryStatus: 'sent',
        metadata: {
          accepted: payload.to,
          rejected: [],
          response: messageId,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const responseData =
          typeof error.response?.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response?.data ?? {});
        this.logger.error(
          `Resend email request failed with status ${error.response?.status ?? 'unknown'}: ${responseData}`,
        );
      } else {
        this.logger.error(
          `Resend email request failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getEmailAddress(target: NotificationTarget): string | null {
    if (target.userId) {
      return `user_${target.userId}@example.com`;
    }

    return null;
  }

  private buildHtmlBody(payload: NotificationPayload): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${payload.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          ${payload.image ? '.image { width: 100%; max-width: 400px; height: auto; border-radius: 4px; margin: 20px 0; }' : ''}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${payload.title}</h1>
          </div>
          <div class="content">
            ${payload.image ? `<img src="${payload.image}" alt="Notification Image" class="image">` : ''}
            <p>${payload.body}</p>
            ${payload.clickAction ? `<a href="${payload.clickAction}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>&copy; 2024 Too Fresh To Waste. All rights reserved.</p>
            <p>You're receiving this email because you're subscribed to our notifications.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getDefaultSenderEmail(): string {
    return this.getRequiredConfigValue('EMAIL_FROM_ADDRESS');
  }

  private getDefaultFromAddress(): string {
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'Too Fresh To Waste');
    const fromEmail = this.getDefaultSenderEmail();
    return `${fromName} <${fromEmail}>`;
  }

  private mapAttachments(attachments: Mail.Attachment[]): Array<{
    filename: string;
    content: string;
  }> {
    return attachments
      .filter(
        (
          attachment,
        ): attachment is Mail.Attachment & {
          filename: string;
          content: string | Buffer;
        } => {
          return (
            typeof attachment.filename === 'string' &&
            attachment.filename.length > 0 &&
            (typeof attachment.content === 'string' || Buffer.isBuffer(attachment.content))
          );
        },
      )
      .map(attachment => ({
        filename: attachment.filename,
        content:
          typeof attachment.content === 'string'
            ? Buffer.from(attachment.content).toString('base64')
            : attachment.content.toString('base64'),
      }));
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getOrderConfirmationTemplate(data: Record<string, unknown>): string {
    return `
      <h2>Order Confirmed!</h2>
      <p>Hi ${data['userName']},</p>
      <p>Your order for "${data['offerTitle']}" has been confirmed.</p>
      <p><strong>Pickup Details:</strong></p>
      <ul>
        <li>Location: ${data['establishmentName']}</li>
        <li>Address: ${data['pickupAddress']}</li>
        <li>Time: ${data['pickupTime']}</li>
        <li>Order ID: ${data['orderId']}</li>
      </ul>
      <p>Please arrive during the specified pickup window and present your QR code.</p>
    `;
  }

  private getPickupReminderTemplate(data: Record<string, unknown>): string {
    return `
      <h2>Pickup Reminder</h2>
      <p>Hi ${data['userName']},</p>
      <p>This is a reminder that your order "${data['offerTitle']}" is ready for pickup!</p>
      <p><strong>Pickup Window:</strong> ${data['pickupTime']}</p>
      <p><strong>Location:</strong> ${data['establishmentName']}, ${data['pickupAddress']}</p>
      <p>Don't forget to bring your QR code!</p>
    `;
  }

  private getPasswordResetTemplate(data: Record<string, unknown>): string {
    return `
      <h2>Password Reset Request</h2>
      <p>Hi ${data['userName']},</p>
      <p>You requested a password reset for your Too Fresh To Waste account.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${data['resetLink']}" class="button">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;
  }

  private getWelcomeTemplate(data: Record<string, unknown>): string {
    return `
      <h2>Welcome to Too Fresh To Waste!</h2>
      <p>Hi ${data['userName']},</p>
      <p>Welcome to our community dedicated to reducing food waste!</p>
      <p>You can now:</p>
      <ul>
        <li>Discover great deals on surplus food near you</li>
        <li>Save money while helping the environment</li>
        <li>Support local businesses</li>
      </ul>
      <p>Start exploring offers in your area!</p>
      <a href="${data['appLink']}" class="button">Start Exploring</a>
    `;
  }
}
