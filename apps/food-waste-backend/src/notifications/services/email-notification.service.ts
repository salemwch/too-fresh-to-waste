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
  private readonly brevoClient: AxiosInstance;
  private readonly brevoApiUrl: string;

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreference>,
    private readonly configService: ConfigService,
  ) {
    void this.preferencesModel;

    const apiKey = this.getRequiredConfigValue('BREVO_API_KEY');
    const apiBaseUrl =
      this.getNonEmptyConfigValue('BREVO_API_BASE_URL') ?? 'https://api.brevo.com/v3';
    this.brevoApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/smtp/email`;
    this.brevoClient = axios.create({
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
    });

    this.logger.log('Brevo notification email service initialized');
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
      throw new Error(`${key} is required for Brevo email delivery`);
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

      return await this.sendViaBrevo({
        to: [{ email: emailAddress }],
        subject: payload.title,
        htmlContent: this.buildHtmlBody(payload),
        textContent: payload.body,
        headers: {
          'X-Mailer': 'TooFreshToWaste-Platform',
          'X-Priority': '3',
        },
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

      const from = this.parseAddress(
        options?.from ?? this.getDefaultFromAddress(),
        this.getDefaultSenderEmail(),
      );
      const replyTo = options?.replyTo
        ? this.parseAddress(options.replyTo, this.getDefaultSenderEmail())
        : undefined;

      const result = await this.sendViaBrevo({
        sender: from,
        to: [{ email: emailAddress }],
        subject: templateData.subject,
        htmlContent: templateData.htmlBody,
        textContent: templateData.textBody ?? this.stripHtml(templateData.htmlBody),
        attachment: this.mapAttachments(options?.attachments ?? []),
        headers: {
          'X-Mailer': 'TooFreshToWaste-Platform',
          'X-Priority': '3',
        },
        ...(replyTo ? { replyTo } : {}),
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

  private async sendViaBrevo(payload: {
    sender?: { name?: string; email: string };
    to: Array<{ email: string; name?: string }>;
    replyTo?: { name?: string; email: string };
    subject: string;
    htmlContent: string;
    textContent?: string;
    attachment?: Array<{ name: string; content: string }>;
    headers?: Record<string, string>;
  }): Promise<NotificationResult> {
    try {
      const sender =
        payload.sender ??
        this.parseAddress(this.getDefaultFromAddress(), this.getDefaultSenderEmail());
      const headers = {
        ...(payload.headers ?? {}),
        'Idempotency-Key': payload.headers?.['Idempotency-Key'] ?? randomUUID(),
      };

      const response = await this.brevoClient.post<{
        messageId?: string;
      }>(this.brevoApiUrl, {
        ...payload,
        headers,
        sender,
      });

      const recipients = payload.to.map(recipient => recipient.email);
      const messageId = response.data.messageId ?? 'unknown';

      return {
        success: true,
        messageId,
        deliveryStatus: 'sent',
        metadata: {
          accepted: recipients,
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
          `Brevo email request failed with status ${error.response?.status ?? 'unknown'}: ${responseData}`,
        );
      } else {
        this.logger.error(
          `Brevo email request failed: ${(error as Error).message}`,
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
    return this.getRequiredConfigValue('BREVO_FROM_EMAIL');
  }

  private getDefaultFromAddress(): string {
    const fromName = this.configService.get<string>('BREVO_FROM_NAME', 'Too Fresh To Waste');
    const fromEmail = this.getDefaultSenderEmail();
    return `"${fromName}" <${fromEmail}>`;
  }

  private parseAddress(
    rawAddress: string,
    fallbackEmail: string,
  ): {
    name?: string;
    email: string;
  } {
    const trimmed = rawAddress.trim();
    const namedMatch = /^"?([^"]+)"?\s*<([^>]+)>$/.exec(trimmed);

    if (namedMatch) {
      const name = namedMatch[1]?.trim();
      const email = namedMatch[2]?.trim();

      if (email) {
        return {
          ...(name ? { name } : {}),
          email,
        };
      }
    }

    return {
      email: trimmed.length > 0 ? trimmed : fallbackEmail,
    };
  }

  private mapAttachments(attachments: Mail.Attachment[]): Array<{
    name: string;
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
        name: attachment.filename,
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
