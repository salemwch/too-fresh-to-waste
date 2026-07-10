import { randomUUID } from 'node:crypto';

import {
  VerificationEmail,
  ResetPasswordEmail,
  WelcomeEmail,
  GoogleLinkedEmail,
  OAuthSignInEmail,
} from '@foodwaste/email-templates';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import axios, { AxiosInstance } from 'axios';
import * as React from 'react';

import { User } from '../users/schemas/user.schema';

import { IEmailService, EmailOptions } from './interfaces/email-service.interface';

@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendClient: AxiosInstance;
  private readonly resendApiUrl = 'https://api.resend.com/emails';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.getRequiredConfigValue('RESEND_API_KEY');

    this.resendClient = axios.create({
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    this.logger.log('Resend email service initialized');
  }

  // ── Config helpers ──────────────────────────────────────────────────────────

  private getNonEmptyConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    if (value === null || value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private getRequiredConfigValue(key: string): string {
    const value = this.getNonEmptyConfigValue(key);
    if (!value) {
      throw new Error(`${key} is required for Resend email delivery`);
    }
    return value;
  }

  private getFrontendUrl(): string {
    const url = this.getNonEmptyConfigValue('WEB_FRONTEND_URL');
    return url ? url.replace(/\/$/, '') : 'http://localhost:3001';
  }

  private getFromAddress(): string {
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'Too Fresh To Waste');
    const fromEmail = this.getRequiredConfigValue('EMAIL_FROM_ADDRESS');
    return `${fromName} <${fromEmail}>`;
  }

  // ── Core send ───────────────────────────────────────────────────────────────

  async sendEmail(emailOptions: EmailOptions): Promise<boolean> {
    const maxRetries = 3;

    const recipients = Array.isArray(emailOptions.to) ? emailOptions.to : [emailOptions.to];
    const to = recipients.filter((r): r is string => typeof r === 'string');

    if (to.length === 0) {
      this.logger.error('Failed to send email: no valid recipients provided');
      return false;
    }

    const payload = {
      from: this.getFromAddress(),
      to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      ...(emailOptions.text ? { text: emailOptions.text } : {}),
      headers: {
        'X-Mailer': 'TooFreshToWaste-Platform',
        'Idempotency-Key': randomUUID(),
      },
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.resendClient.post<{ id?: string }>(this.resendApiUrl, payload);
        const messageId = response.data.id ?? 'unknown';
        this.logger.log(`Email sent to ${to.join(', ')}: ${messageId}`);
        return true;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryable = this.isRetryableError(error);

        if (isLastAttempt || !isRetryable) {
          this.logger.error(
            `Failed to send email to ${to.join(', ')} after ${attempt} attempt(s):`,
            error instanceof Error ? error.stack : String(error),
          );
          return false;
        }

        const delayMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.warn(
          `Email attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms…`,
        );
        await this.delay(delayMs);
      }
    }

    return false;
  }

  private isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error;
    }

    const status = error.response?.status;
    const code = error.code ?? '';
    const message = error.message.toLowerCase();

    return (
      status === 429 ||
      status === 408 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      code === 'ECONNABORTED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN' ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('socket hang up')
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Typed send helpers ──────────────────────────────────────────────────────

  async sendVerificationEmail(user: User, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${this.getFrontendUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    const html = await render(
      React.createElement(VerificationEmail, {
        firstName: user.firstName || 'there',
        verificationUrl,
      }),
    );

    const text = [
      `Hello ${user.firstName || 'there'},`,
      '',
      'Welcome to Too Fresh To Waste! Please verify your email address by visiting:',
      verificationUrl,
      '',
      'This link expires in 24 hours.',
      '',
      "If you didn't create an account, please ignore this email.",
      '',
      'Best regards,',
      'The Too Fresh To Waste Team',
    ].join('\n');

    return this.sendEmail({
      to: user.email,
      subject: 'Verify your Too Fresh To Waste account',
      html,
      text,
    });
  }

  async sendWelcomeEmail(user: User): Promise<boolean> {
    const appUrl = this.getFrontendUrl();

    const html = await render(
      React.createElement(WelcomeEmail, {
        firstName: user.firstName || 'there',
        appUrl,
      }),
    );

    const text = [
      `Hello ${user.firstName || 'there'},`,
      '',
      'Welcome to Too Fresh To Waste! Your account has been successfully verified.',
      '',
      'You can now:',
      '- Browse surplus food offers from local businesses',
      '- Purchase quality meals at reduced prices',
      '- Help reduce food waste in your community',
      '',
      `Start exploring: ${appUrl}`,
      '',
      'Best regards,',
      'The Too Fresh To Waste Team',
    ].join('\n');

    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Too Fresh To Waste — Account Verified!',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const html = await render(
      React.createElement(ResetPasswordEmail, {
        firstName: user.firstName || 'there',
        resetUrl,
      }),
    );

    const text = [
      `Hello ${user.firstName || 'there'},`,
      '',
      'You requested a password reset for your Too Fresh To Waste account.',
      'Click the link below (or paste it into your browser) to create a new password:',
      resetUrl,
      '',
      'This link expires in 1 hour.',
      '',
      "If you didn't request this, please ignore this email.",
      '',
      'Best regards,',
      'The Too Fresh To Waste Team',
    ].join('\n');

    return this.sendEmail({
      to: user.email,
      subject: 'Reset your Too Fresh To Waste password',
      html,
      text,
    });
  }

  async sendGoogleLinkedEmail(email: string, firstName: string): Promise<boolean> {
    const html = await render(React.createElement(GoogleLinkedEmail, { firstName }));

    const text = [
      `Hi ${firstName},`,
      '',
      'Your Too Fresh To Waste account has been linked to Google Sign-In.',
      'You can now sign in quickly using your Google account.',
      '',
      'If you did not initiate this, please contact support immediately.',
      '',
      'Best regards,',
      'The Too Fresh To Waste Team',
    ].join('\n');

    return this.sendEmail({
      to: email,
      subject: 'Google Sign-In linked to your Too Fresh To Waste account',
      html,
      text,
    });
  }

  async sendOAuthSignInEmail(user: User): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const provider = user.authProvider ?? 'google';
    const providerLabels: Record<string, string> = {
      google: 'Google',
      facebook: 'Facebook',
      apple: 'Apple',
    };
    const providerLabel = providerLabels[provider] ?? provider;
    const loginUrl = `${this.getFrontendUrl()}/login`;

    const html = await render(
      React.createElement(OAuthSignInEmail, { firstName, provider, loginUrl }),
    );

    const text = [
      `Hi ${firstName},`,
      '',
      `We received a password reset request for your Too Fresh To Waste account.`,
      `However, your account was created using ${providerLabel} Sign-In — no password is associated with it.`,
      '',
      `To access your account, sign in with ${providerLabel} at: ${loginUrl}`,
      '',
      'If you did not request this, no action is needed — your account is safe.',
      '',
      'Best regards,',
      'The Too Fresh To Waste Team',
    ].join('\n');

    return this.sendEmail({
      to: user.email,
      subject: `Sign in to Too Fresh To Waste with ${providerLabel}`,
      html,
      text,
    });
  }
}
