import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

/**
 * Password History Service
 *
 * Enforces password history tracking to prevent password reuse.
 * Implements OWASP password storage best practices.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 * @see https://pages.nist.gov/800-63-3/sp800-63b.html
 */
@Injectable()
export class PasswordHistoryService {
  private readonly logger = new Logger(PasswordHistoryService.name);

  // Default configuration: prevent reuse of last 5 passwords (NIST recommendation: at least 3)
  private readonly DEFAULT_PASSWORD_HISTORY_COUNT = 5;
  private readonly DEFAULT_ENFORCE_HISTORY = true;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if a new password has been used before
   *
   * @param newPassword - Plain text password to check
   * @param passwordHistory - Array of hashed previous passwords
   * @returns Promise resolving to true if password was used before, false otherwise
   */
  async isPasswordReused(
    newPassword: string,
    passwordHistory: string[] = [],
  ): Promise<boolean> {
    if (!this.isHistoryEnforced() || passwordHistory?.length === 0) {
      return false;
    }

    try {
      // Check against each historical password hash
      for (const historicalHash of passwordHistory) {
        try {
          const isMatch = await argon2.verify(historicalHash, newPassword);
          if (isMatch) {
            this.logger.warn('Password reuse detected');
            return true;
          }
        } catch (error) {
          // If verification fails for a specific hash, log and continue
          this.logger.debug('Failed to verify against historical password hash', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking password history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail open: don't block password change on history check failure
      return false;
    }
  }

  /**
   * Add a password hash to history
   * Maintains only the configured number of most recent passwords
   *
   * @param currentPasswordHash - Current password hash to add to history
   * @param existingHistory - Existing password history array
   * @returns Updated password history array
   */
  addToHistory(
    currentPasswordHash: string,
    existingHistory: string[] = [],
  ): string[] {
    const maxHistoryCount = this.getPasswordHistoryCount();

    // Add current password to beginning of history
    const updatedHistory = [currentPasswordHash, ...existingHistory];

    // Keep only the most recent N passwords
    return updatedHistory.slice(0, maxHistoryCount);
  }

  /**
   * Validate that a new password doesn't violate history policy
   * Throws BadRequestException if password was previously used
   *
   * @param newPassword - Plain text password to validate
   * @param passwordHistory - Array of hashed previous passwords
   * @throws BadRequestException if password reuse is detected
   */
  async validatePasswordHistory(
    newPassword: string,
    passwordHistory: string[] = [],
  ): Promise<void> {
    const isReused = await this.isPasswordReused(newPassword, passwordHistory);

    if (isReused) {
      const historyCount = this.getPasswordHistoryCount();
      throw new BadRequestException({
        message: `Password cannot be one of your last ${historyCount} passwords`,
        type: 'PASSWORD_REUSE_VIOLATION',
        historyCount,
      });
    }
  }

  /**
   * Get the configured password history count
   * @returns Number of previous passwords to track
   */
  getPasswordHistoryCount(): number {
    return (
      this.configService.get<number>('PASSWORD_HISTORY_COUNT') ||
      this.DEFAULT_PASSWORD_HISTORY_COUNT
    );
  }

  /**
   * Check if password history enforcement is enabled
   * @returns true if history enforcement is enabled
   */
  isHistoryEnforced(): boolean {
    return (
      this.configService.get<boolean>('PASSWORD_ENFORCE_HISTORY') ??
      this.DEFAULT_ENFORCE_HISTORY
    );
  }

  /**
   * Get password history policy configuration
   * @returns Object containing history policy settings
   */
  getHistoryPolicy(): {
    enforced: boolean;
    historyCount: number;
  } {
    return {
      enforced: this.isHistoryEnforced(),
      historyCount: this.getPasswordHistoryCount(),
    };
  }
}
