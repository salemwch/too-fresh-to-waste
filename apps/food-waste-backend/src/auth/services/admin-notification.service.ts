import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import { EmailService } from '../../email/email.service';
import {
  SecurityEvent,
  SecurityEventPayload,
  SecurityEventType,
  SecuritySeverity,
} from '../events/security-events';

/**
 * Admin Notification Service
 * Enterprise-grade security event monitoring and alert system
 *
 * @description Handles real-time security alerts to system administrators
 * when suspicious activities, lockouts, or security violations occur
 *
 * Features:
 * - Email alerts for critical security events
 * - Event aggregation to prevent alert fatigue
 * - Configurable severity thresholds
 * - Structured logging for SIEM integration
 */
@Injectable()
export class AdminNotificationService {
  private readonly logger = new Logger(AdminNotificationService.name);
  private readonly adminEmails: string[];
  private readonly minSeverityLevel: SecuritySeverity;
  private readonly isEnabled: boolean;

  // Alert throttling to prevent spam (track last notification time)
  private readonly alertThrottleMap = new Map<string, Date>();
  private readonly THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    // Load configuration
    this.adminEmails = this.parseAdminEmails(
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAILS', ''),
    );
    this.minSeverityLevel = this.configService.get<SecuritySeverity>(
      'SECURITY_ALERT_MIN_SEVERITY',
      SecuritySeverity.HIGH,
    );
    this.isEnabled = this.configService.get<boolean>('ADMIN_NOTIFICATIONS_ENABLED', true);

    if (this.isEnabled && this.adminEmails.length === 0) {
      this.logger.warn(
        'Admin notifications enabled but no admin emails configured. ' +
          'Set ADMIN_NOTIFICATION_EMAILS environment variable.',
      );
    }

    this.logger.log(
      `✅ AdminNotificationService initialized - ` +
        `Enabled: ${this.isEnabled}, Admins: ${this.adminEmails.length}, ` +
        `Min Severity: ${this.minSeverityLevel}`,
    );
  }

  /**
   * Listen for security events and send notifications
   */
  @OnEvent('security.*', { async: true })
  async handleSecurityEvent(event: SecurityEventPayload): Promise<void> {
    if (!this.isEnabled || this.adminEmails.length === 0) {
      return;
    }

    // Check severity threshold
    if (!this.shouldNotify(event.severity)) {
      this.logger.debug(`Skipping notification for ${event.type} (severity: ${event.severity})`);
      return;
    }

    // Throttle duplicate alerts
    const throttleKey = `${event.type}:${event.ipAddress}`;
    if (this.isThrottled(throttleKey)) {
      this.logger.debug(`Throttled notification for ${throttleKey}`);
      return;
    }

    // Log structured event for SIEM integration
    this.logSecurityEvent(event);

    // Send email notification
    try {
      await this.sendEmailNotification(event);
      this.updateThrottle(throttleKey);

      this.logger.log(
        `Security notification sent to ${this.adminEmails.length} admins for ${event.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin notification for ${event.type}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Manual notification trigger for custom security events
   */
  async notifyAdmins(event: SecurityEvent): Promise<void> {
    const payload = event.toPayload();
    await this.handleSecurityEvent(payload);
  }

  /**
   * Send email notification to administrators
   */
  private async sendEmailNotification(event: SecurityEventPayload): Promise<void> {
    const subject = this.buildEmailSubject(event);
    const htmlBody = this.buildEmailBody(event);

    // Send to all configured admin emails
    await Promise.allSettled(
      this.adminEmails.map(async (email) => {
        await this.emailService.sendEmail({
          to: email,
          subject,
          html: htmlBody,
        });
      }),
    );
  }

  /**
   * Build email subject line
   */
  private buildEmailSubject(event: SecurityEventPayload): string {
    const severityEmoji = this.getSeverityEmoji(event.severity);
    const eventName = this.getEventName(event.type);

    return `${severityEmoji} Security Alert: ${eventName}`;
  }

  /**
   * Build detailed HTML email body
   */
  private buildEmailBody(event: SecurityEventPayload): string {
    const severityColor = this.getSeverityColor(event.severity);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${severityColor}; color: white; padding: 15px; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; border-radius: 5px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; margin-left: 10px; }
            .metadata { background-color: #fff; padding: 15px; margin-top: 15px; border-left: 3px solid ${severityColor}; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${this.getSeverityEmoji(event.severity)} Security Alert</h2>
              <p style="margin: 5px 0;"><strong>${this.getEventName(event.type)}</strong></p>
            </div>

            <div class="content">
              <div class="detail-row">
                <span class="label">Severity:</span>
                <span class="value" style="color: ${severityColor}; font-weight: bold;">
                  ${event.severity.toUpperCase()}
                </span>
              </div>

              <div class="detail-row">
                <span class="label">Timestamp:</span>
                <span class="value">${event.timestamp.toISOString()}</span>
              </div>

              <div class="detail-row">
                <span class="label">IP Address:</span>
                <span class="value">${event.ipAddress}</span>
              </div>

              ${
                event.email
                  ? `
              <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value">${event.email}</span>
              </div>
              `
                  : ''
              }

              ${
                event.userId
                  ? `
              <div class="detail-row">
                <span class="label">User ID:</span>
                <span class="value">${event.userId}</span>
              </div>
              `
                  : ''
              }

              ${
                event.userAgent
                  ? `
              <div class="detail-row">
                <span class="label">User Agent:</span>
                <span class="value" style="font-size: 11px;">${event.userAgent}</span>
              </div>
              `
                  : ''
              }

              <div class="metadata">
                <h4 style="margin-top: 0;">Event Details:</h4>
                <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto;">
${JSON.stringify({ ...event.details, ...event.metadata }, null, 2)}
                </pre>
              </div>

              <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 3px solid #ffc107; border-radius: 3px;">
                <strong>⚠️ Action Required:</strong>
                <p style="margin: 5px 0 0 0;">
                  Review this security event and take appropriate action if necessary.
                  Check system logs for additional context.
                </p>
              </div>
            </div>

            <div class="footer">
              <p>
                This is an automated security notification from the Food Waste Backend System.<br>
                Do not reply to this email.
              </p>
              <p style="margin-top: 10px; font-style: italic;">
                Generated by AdminNotificationService at ${new Date().toISOString()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Log structured security event for SIEM integration
   */
  private logSecurityEvent(event: SecurityEventPayload): void {
    const structuredLog = {
      event_type: event.type,
      severity: event.severity,
      timestamp: event.timestamp.toISOString(),
      source_ip: event.ipAddress,
      email: event.email,
      user_id: event.userId,
      user_agent: event.userAgent,
      details: event.details,
      metadata: event.metadata,
    };

    // Log based on severity
    switch (event.severity) {
      case SecuritySeverity.CRITICAL:
        this.logger.error(`[SECURITY-CRITICAL] ${JSON.stringify(structuredLog)}`);
        break;
      case SecuritySeverity.HIGH:
        this.logger.warn(`[SECURITY-HIGH] ${JSON.stringify(structuredLog)}`);
        break;
      case SecuritySeverity.MEDIUM:
        this.logger.warn(`[SECURITY-MEDIUM] ${JSON.stringify(structuredLog)}`);
        break;
      default:
        this.logger.log(`[SECURITY-LOW] ${JSON.stringify(structuredLog)}`);
    }
  }

  /**
   * Check if notification should be sent based on severity
   */
  private shouldNotify(severity: SecuritySeverity): boolean {
    const severityLevels = {
      [SecuritySeverity.LOW]: 0,
      [SecuritySeverity.MEDIUM]: 1,
      [SecuritySeverity.HIGH]: 2,
      [SecuritySeverity.CRITICAL]: 3,
    };

    return severityLevels[severity] >= severityLevels[this.minSeverityLevel];
  }

  /**
   * Check if alert is throttled
   */
  private isThrottled(key: string): boolean {
    const lastNotification = this.alertThrottleMap.get(key);

    if (!lastNotification) {
      return false;
    }

    const elapsedTime = Date.now() - lastNotification.getTime();
    return elapsedTime < this.THROTTLE_DURATION_MS;
  }

  /**
   * Update throttle timestamp
   */
  private updateThrottle(key: string): void {
    this.alertThrottleMap.set(key, new Date());

    // Cleanup old entries (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [k, timestamp] of this.alertThrottleMap.entries()) {
      if (timestamp.getTime() < oneHourAgo) {
        this.alertThrottleMap.delete(k);
      }
    }
  }

  /**
   * Parse comma-separated admin emails from config
   */
  private parseAdminEmails(emailString: string): string[] {
    return emailString
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0 && email.includes('@'));
  }

  /**
   * Get human-readable event name
   */
  private getEventName(type: SecurityEventType): string {
    const names: Record<SecurityEventType, string> = {
      [SecurityEventType.ACCOUNT_LOCKED]: 'Account Locked',
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 'Rate Limit Exceeded',
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: 'Suspicious Activity Detected',
      [SecurityEventType.IP_BLOCKED]: 'IP Address Blocked',
      [SecurityEventType.CAPTCHA_REQUIRED]: 'CAPTCHA Required',
      [SecurityEventType.CAPTCHA_FAILED]: 'CAPTCHA Verification Failed',
      [SecurityEventType.BRUTE_FORCE_DETECTED]: 'Brute Force Attack Detected',
      [SecurityEventType.TOKEN_THEFT_DETECTED]: 'Token Theft Detected',
      [SecurityEventType.MULTIPLE_FAILED_LOGINS]: 'Multiple Failed Login Attempts',
    };

    return names[type] || type;
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: SecuritySeverity): string {
    const emojis = {
      [SecuritySeverity.LOW]: 'ℹ️',
      [SecuritySeverity.MEDIUM]: '⚠️',
      [SecuritySeverity.HIGH]: '🚨',
      [SecuritySeverity.CRITICAL]: '🔴',
    };

    return emojis[severity] || '⚠️';
  }

  /**
   * Get severity color for email styling
   */
  private getSeverityColor(severity: SecuritySeverity): string {
    const colors = {
      [SecuritySeverity.LOW]: '#17a2b8',
      [SecuritySeverity.MEDIUM]: '#ffc107',
      [SecuritySeverity.HIGH]: '#fd7e14',
      [SecuritySeverity.CRITICAL]: '#dc3545',
    };

    return colors[severity] || '#ffc107';
  }

  /**
   * Health check for monitoring
   */
  getStatus(): {
    enabled: boolean;
    adminCount: number;
    minSeverity: SecuritySeverity;
    throttledAlerts: number;
  } {
    return {
      enabled: this.isEnabled,
      adminCount: this.adminEmails.length,
      minSeverity: this.minSeverityLevel,
      throttledAlerts: this.alertThrottleMap.size,
    };
  }
}
