import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';

import { INotificationProvider, NotificationResult } from '../interfaces/notification.interfaces';
import { NotificationPreference } from '../schemas/notification-preference.schema';
import { NotificationTarget, NotificationPayload } from '../types/notification.types';

import type Mail from 'nodemailer/lib/mailer';

@Injectable()
export class EmailNotificationService implements INotificationProvider {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter!: nodemailer.Transporter;

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreference>,
    private readonly configService: ConfigService,
  ) {
    void this.preferencesModel;
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = {
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: this.configService.get('SMTP_SECURE', false),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verify connection configuration
    this.transporter.verify((error, _success) => {
      if (error) {
        this.logger.error('SMTP configuration error:', error);
      } else {
        this.logger.log('SMTP server connection established successfully');
      }
    });
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

      const mailOptions = this.buildEmailMessage(payload, emailAddress);
      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        deliveryStatus: 'sent',
        metadata: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
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
    const emailPromises = targets.map(async (target) => {
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

      const mailOptions = {
        from: options?.from || this.getDefaultFromAddress(),
        to: emailAddress,
        replyTo: options?.replyTo,
        subject: templateData.subject,
        html: templateData.htmlBody,
        text: templateData.textBody || this.stripHtml(templateData.htmlBody),
        attachments: options?.attachments || [],
        headers: {
          'X-Mailer': 'TooFreshToWaste-Platform',
          'X-Priority': '3',
        },
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        deliveryStatus: 'sent',
        metadata: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
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
    if (!template) {
      return { success: false, error: `Unknown email template type: ${type}` };
    }

    const result = await this.sendTemplateEmail(template, target);
    return result;
  }

  private getEmailAddress(target: NotificationTarget): string | null {
    if (target.userId) {
      // Get user email from user collection or preferences
      // This would typically require injecting the User model
      // For now, return a placeholder
      return `user_${target.userId}@example.com`;
    }

    return null;
  }

  private buildEmailMessage(payload: NotificationPayload, emailAddress: string) {
    return {
      from: this.getDefaultFromAddress(),
      to: emailAddress,
      subject: payload.title,
      html: this.buildHtmlBody(payload),
      text: payload.body,
      headers: {
        'X-Mailer': 'TooFreshToWaste-Platform',
        'X-Priority': '3',
      },
    };
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

  private getDefaultFromAddress(): string {
    const fromName = this.configService.get('EMAIL_FROM_NAME', 'Too Fresh To Waste');
    const fromEmail = this.configService.get('EMAIL_FROM_ADDRESS', 'noreply@foodwaste.com');
    return `"${fromName}" <${fromEmail}>`;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Template methods - these would typically be in separate template files
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
