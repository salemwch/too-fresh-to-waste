// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { User } from '../users/schemas/user.schema';

import { IEmailService, EmailOptions } from './interfaces/email-service.interface';

/**
 * EmailService - Concrete implementation of IEmailService
 *
 * Implements enterprise-grade email functionality with:
 * - Interface-based dependency inversion
 * - SMTP configuration
 * - Templated emails (verification, welcome, password reset)
 * - Mobile deep linking support
 *
 * @implements {IEmailService}
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        // SECURITY: Must be true in production to prevent MITM on SMTP connection
        // Only disable in development for self-signed certs / local mail servers
        rejectUnauthorized: isProduction,
      },
      // Connection pool for better throughput
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeouts to prevent hanging connections
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

    this.transporter.verify((error, _success) => {
      if (error) {
        this.logger.error('Email service connection failed:', error);
      } else {
        this.logger.log('Email service is ready to send messages');
      }
    });
  }

  /**
   * Send email with exponential backoff retry (3 attempts).
   * Retries on transient SMTP errors (connection reset, timeout, rate limit).
   */
  async sendEmail(emailOptions: EmailOptions): Promise<boolean> {
    const maxRetries = 3;
    const smtpUser = this.configService.get<string>('SMTP_USER') || 'noreply@foodwaste.com';
    const fromName = this.configService.get<string>('SMTP_FROM_NAME', 'Too Fresh To Waste');
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || smtpUser;
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      ...emailOptions,
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`Email sent to ${emailOptions.to}: ${info.messageId}`);
        return true;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);

        if (isLastAttempt || !isRetryable) {
          this.logger.error(
            `Failed to send email to ${emailOptions.to} after ${attempt} attempt(s):`,
            error,
          );
          return false;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.warn(
          `Email to ${emailOptions.to} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`,
        );
        await this.delay(delayMs);
      }
    }
    return false;
  }

  /** Determine if an SMTP error is transient and worth retrying */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const msg = error.message.toLowerCase();
    const code = (error as NodeJS.ErrnoException).code ?? '';
    // Transient: connection reset, timeout, DNS issues, SMTP 4xx, rate limiting
    return (
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED' ||
      code === 'ESOCKET' ||
      code === 'EDNS' ||
      msg.includes('timeout') ||
      msg.includes('too many connections') ||
      msg.includes('try again') ||
      msg.includes('temporarily')
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // eslint-disable-next-line require-await
  async sendVerificationEmail(user: User, verificationToken: string): Promise<boolean> {
    // PRODUCTION-READY: Use HTTPS redirect endpoint (works in ALL email clients)
    // Backend serves smart redirect page that:
    // 1. Attempts to open mobile app (deep link)
    // 2. Falls back to web verification if app not installed
    // 3. Works on desktop, mobile, all email clients (Gmail, Outlook, Apple Mail, etc.)
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
    const verificationUrl = `${backendUrl}/api/v1/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

    const html = this.generateVerificationEmailTemplate(user.firstName, verificationUrl);
    const text = `
      Hello ${user.firstName},

      Welcome to Too Fresh To Waste! Please verify your email address by clicking this link:
      ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account, please ignore this email.

      Best regards,
      The Too Fresh To Waste Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Verify your Too Fresh To Waste account',
      html,
      text,
    });
  }

  // eslint-disable-next-line require-await
  async sendWelcomeEmail(user: User): Promise<boolean> {
    const html = this.generateWelcomeEmailTemplate(user.firstName);
    const text = `
      Hello ${user.firstName},

      Welcome to Too Fresh To Waste! Your account has been successfully verified.

      You can now:
      - Browse surplus food offers from local businesses
      - Purchase quality meals at reduced prices
      - Help reduce food waste in your community

      Start exploring amazing deals near you!

      Best regards,
      The Too Fresh To Waste Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Too Fresh To Waste - Account Verified!',
      html,
      text,
    });
  }

  // eslint-disable-next-line require-await
  async sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean> {
    // PRODUCTION-READY: Use HTTPS redirect endpoint (same as email verification)
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
    const resetUrl = `${backendUrl}/api/v1/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    const html = this.generatePasswordResetEmailTemplate(user.firstName, resetUrl);
    const text = `
      Hello ${user.firstName},

      You requested a password reset for your Too Fresh To Waste account.
      Click the following link to reset your password:
      ${resetUrl}

      This link will expire in 1 hour.

      If you didn't request this, please ignore this email.

      Best regards,
      The Too Fresh To Waste Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Reset your Too Fresh To Waste password',
      html,
      text,
    });
  }

  private generateVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #667eea; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">🍽️ Too Fresh To Waste</h1>
  </div>

  <div style="background-color: white; padding: 30px;">

    <h2 style="color: #333;">Hi ${firstName}! 👋</h2>

    <p style="font-size: 16px;">
      Welcome to Too Fresh To Waste! Click the button below to verify your email:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
        ✅ Verify Email Address
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      <strong>On mobile:</strong> The link will automatically open the Too Fresh To Waste app if you have it installed.
    </p>

    <p style="font-size: 14px; color: #666;">
      <strong>On desktop or without the app:</strong> You can verify directly in your browser.
    </p>

    <p style="font-size: 14px; color: #666;">
      <strong>Trouble clicking the button?</strong> Copy and paste this link in your browser:
    </p>
    <p style="font-size: 12px; background: #f0f0f0; padding: 10px; word-wrap: break-word; font-family: monospace;">
      ${verificationUrl}
    </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⏰ <strong>Important:</strong> This verification link will expire in 24 hours for security reasons.
              </p>
            </div>
            
            <p style="margin: 20px 0; color: #666; font-size: 14px;">
              If you didn't create an account with us, please ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br><strong>The Too Fresh To Waste Team</strong></p>
              <p style="margin-top: 20px;">
                <img src="${this.configService.get<string>('BACKEND_URL', 'http://localhost:3000')}/public/images/leaf.png" alt="leaf" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 5px;" />
                <em>Together, we're making a difference in reducing food waste!</em>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateWelcomeEmailTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Too Fresh To Waste</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your account is now active</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName}! 🍽️</h2>
            
            <p style="margin: 20px 0;">Congratulations! Your Too Fresh To Waste account has been successfully verified and is ready to use.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">What you can do now:</h3>
              <ul style="color: #155724; margin: 0; padding-left: 20px;">
                <li style="margin: 10px 0;">🥘 Browse surplus food offers from local restaurants and bakeries</li>
                <li style="margin: 10px 0;">💰 Purchase quality meals at up to 70% off regular prices</li>
                <li style="margin: 10px 0;">🌍 Help reduce food waste in your community</li>
                <li style="margin: 10px 0;">⭐ Rate and review your favorite merchants</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.configService.get<string>('FRONTEND_URL')}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                🚀 Start Exploring
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br><strong>The Too Fresh To Waste Team</strong></p>
              <p style="margin-top: 20px;">
                <img src="${this.configService.get<string>('BACKEND_URL', 'http://localhost:3000')}/public/images/leaf.png" alt="leaf" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 5px;" />
                <em>Thank you for joining our mission to reduce food waste!</em>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePasswordResetEmailTemplate(firstName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Secure your account</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            
            <p style="margin: 20px 0;">We received a request to reset your Too Fresh To Waste account password.</p>
            
            <p style="margin: 20px 0;">Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                🔑 Reset Password
              </a>
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #721c24;">
                ⚠️ <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
              </p>
            </div>
            
            <p style="margin: 20px 0; font-size: 14px; color: #666;">
              If the button doesn't work, copy and paste this link:<br>
              <a href="${resetUrl}" style="color: #dc3545; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
