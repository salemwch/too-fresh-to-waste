import * as crypto from 'crypto';

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qrcode from 'qrcode';
import * as speakeasy from 'speakeasy';

import { UsersService } from '../../users/user.service';

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaVerificationResult {
  isValid: boolean;
  remainingAttempts?: number;
  backupCodeUsed?: boolean;
}

export interface MfaStatus {
  isEnabled: boolean;
  methods: {
    totp: boolean;
    sms: boolean;
    email: boolean;
    backupCodes: boolean;
  };
  lastUsed?: Date | undefined;
  trustedDevices: number;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly APP_NAME = 'Food Waste App';
  private readonly BACKUP_CODES_COUNT = 10;

  constructor(
    private readonly _configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    void this._configService;
  }

  async setupTotp(userId: string): Promise<MfaSetupResponse> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: `${this.APP_NAME} (${user.email})`,
        issuer: this.APP_NAME,
        length: 32,
      });

      // Generate QR code
      const qrCodeUrl = speakeasy.otpauthURL({
        secret: secret.ascii,
        label: user.email,
        issuer: this.APP_NAME,
        encoding: 'ascii',
      });

      const qrCode = await qrcode.toDataURL(qrCodeUrl);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store the secret temporarily (not yet activated)
      await this.usersService.updateMfaSettings(userId, {
        pendingTotpSecret: secret.base32,
        backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
      });

      this.logger.log(`TOTP setup initiated for user ${userId}`);

      return {
        secret: secret.base32,
        qrCode,
        backupCodes,
        manualEntryKey: secret.base32,
      };
    } catch (error) {
      this.logger.error(`Error setting up TOTP for user ${userId}:`, error);
      throw new BadRequestException('Failed to setup MFA');
    }
  }

  async verifyTotpSetup(userId: string, token: string): Promise<boolean> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user?.mfaSettings?.pendingTotpSecret) {
        throw new BadRequestException('No pending TOTP setup found');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.mfaSettings.pendingTotpSecret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2-step window for clock drift
      });

      if (isValid) {
        // Activate TOTP
        await this.usersService.activateMfa(userId, {
          totpSecret: user.mfaSettings.pendingTotpSecret,
          pendingTotpSecret: undefined,
          isEnabled: true,
          activatedAt: new Date(),
        });

        this.logger.log(`TOTP activated for user ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error verifying TOTP setup for user ${userId}:`, error);
      throw new BadRequestException('Failed to verify TOTP setup');
    }
  }

  async verifyTotp(userId: string, token: string): Promise<MfaVerificationResult> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || user.mfaSettings?.isEnabled !== true || !user.mfaSettings?.totpSecret) {
        throw new UnauthorizedException('MFA not enabled for this user');
      }

      // Check if it's a backup code
      if (token.length === 8 && /^[A-Z0-9]+$/.test(token)) {
        return await this.verifyBackupCode(userId, token);
      }

      // Verify TOTP token
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSettings.totpSecret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (isValid) {
        // Update last used timestamp
        await this.usersService.updateMfaLastUsed(userId);
        this.logger.log(`TOTP verification successful for user ${userId}`);
      } else {
        this.logger.warn(`TOTP verification failed for user ${userId}`);
      }

      return {
        isValid,
        backupCodeUsed: false,
      };
    } catch (error) {
      this.logger.error(`Error verifying TOTP for user ${userId}:`, error);
      throw new BadRequestException('Failed to verify MFA token');
    }
  }

  async verifyBackupCode(userId: string, code: string): Promise<MfaVerificationResult> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || user.mfaSettings?.isEnabled !== true || !user.mfaSettings?.backupCodes) {
        throw new UnauthorizedException('MFA not enabled or no backup codes available');
      }

      const hashedCode = this.hashBackupCode(code);
      const hashedBuf = Buffer.from(hashedCode);
      const codeIndex = user.mfaSettings.backupCodes.findIndex(storedCode => {
        const storedBuf = Buffer.from(storedCode);
        return (
          hashedBuf.length === storedBuf.length && crypto.timingSafeEqual(hashedBuf, storedBuf)
        );
      });

      if (codeIndex === -1) {
        this.logger.warn(`Invalid backup code used for user ${userId}`);
        return {
          isValid: false,
          backupCodeUsed: true,
        };
      }

      // Remove the used backup code
      const updatedBackupCodes = [...user.mfaSettings.backupCodes];
      updatedBackupCodes.splice(codeIndex, 1);

      await this.usersService.updateMfaSettings(userId, {
        backupCodes: updatedBackupCodes,
        lastUsedAt: new Date(),
      });

      this.logger.log(
        `Backup code used for user ${userId}, ${updatedBackupCodes.length} codes remaining`,
      );

      return {
        isValid: true,
        backupCodeUsed: true,
        remainingAttempts: updatedBackupCodes.length,
      };
    } catch (error) {
      this.logger.error(`Error verifying backup code for user ${userId}:`, error);
      throw new BadRequestException('Failed to verify backup code');
    }
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || user.mfaSettings?.isEnabled !== true) {
        throw new BadRequestException('MFA not enabled for this user');
      }

      const newBackupCodes = this.generateBackupCodes();
      const hashedCodes = newBackupCodes.map(code => this.hashBackupCode(code));

      await this.usersService.updateMfaSettings(userId, {
        backupCodes: hashedCodes,
      });

      this.logger.log(`Backup codes regenerated for user ${userId}`);
      return newBackupCodes;
    } catch (error) {
      this.logger.error(`Error regenerating backup codes for user ${userId}:`, error);
      throw new BadRequestException('Failed to regenerate backup codes');
    }
  }

  async disableMfa(userId: string, verificationToken: string): Promise<void> {
    try {
      // Verify the token before disabling
      const verification = await this.verifyTotp(userId, verificationToken);
      if (!verification.isValid) {
        throw new UnauthorizedException('Invalid verification token');
      }

      await this.usersService.disableMfa(userId);
      this.logger.log(`MFA disabled for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error disabling MFA for user ${userId}:`, error);
      throw new BadRequestException('Failed to disable MFA');
    }
  }

  async getMfaStatus(userId: string): Promise<MfaStatus> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        isEnabled: user.mfaSettings?.isEnabled ?? false,
        methods: {
          totp: !!user.mfaSettings?.totpSecret,
          sms: false, // Not implemented yet
          email: false, // Not implemented yet
          backupCodes: !!(user.mfaSettings?.backupCodes && user.mfaSettings.backupCodes.length > 0),
        },
        lastUsed: user.mfaSettings?.lastAuthAt,
        trustedDevices: user.trustedDevices?.length || 0,
      };
    } catch (error) {
      this.logger.error(`Error getting MFA status for user ${userId}:`, error);
      throw new BadRequestException('Failed to get MFA status');
    }
  }

  async requiresMfa(userId: string): Promise<boolean> {
    try {
      const user = await this.usersService.findById(userId);
      return user?.mfaSettings?.isEnabled === true;
    } catch (error) {
      this.logger.error(`Error checking MFA requirement for user ${userId}:`, error);
      return false;
    }
  }

  async generateEmergencyTokens(userId: string): Promise<string[]> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || user.mfaSettings?.isEnabled !== true) {
        throw new BadRequestException('MFA not enabled for this user');
      }

      const emergencyTokens = this.generateBackupCodes();
      const hashedTokens = emergencyTokens.map(token => this.hashBackupCode(token));

      await this.usersService.updateMfaSettings(userId, {
        emergencyTokens: hashedTokens,
      });

      this.logger.log(`Emergency tokens generated for user ${userId}`);
      return emergencyTokens;
    } catch (error) {
      this.logger.error(`Error generating emergency tokens for user ${userId}:`, error);
      throw new BadRequestException('Failed to generate emergency tokens');
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(crypto.randomInt(chars.length));
      }
      codes.push(code);
    }

    return codes;
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
