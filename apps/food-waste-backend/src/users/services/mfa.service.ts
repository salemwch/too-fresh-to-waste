import * as crypto from 'crypto';

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import * as speakeasy from 'speakeasy';

import { User, UserDocument } from '../schemas/user.schema';

import { appError } from '../../common/errors';
export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaVerificationResult {
  success: boolean;
  backupCodeUsed?: boolean;
  remainingBackupCodes?: number;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly BACKUP_CODES_COUNT = 10;
  private readonly BACKUP_CODE_LENGTH = 8;

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async setupTotp(userId: string): Promise<MfaSetupResult> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException(appError('USER_NOT_FOUND'));
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: user.email,
      issuer: 'FoodWaste App',
      length: 32,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async code => {
        const hashed = await argon2.hash(code);
        return hashed;
      }),
    );

    // Update user with MFA settings
    const mfaMethod = {
      type: 'totp' as const,
      isActive: false, // Will be activated after verification
      secret: secret.base32,
      backupCodes: hashedBackupCodes,
      createdAt: new Date(),
      verified: false,
    };

    user.mfaSettings ??= {
      isEnabled: false,
      methods: [],
      requireForSensitiveActions: true,
      trustDeviceDays: 30,
    };

    // Remove existing TOTP method if any
    user.mfaSettings.methods = user.mfaSettings.methods.filter(method => method.type !== 'totp');

    user.mfaSettings.methods.push(mfaMethod);
    await user.save();

    this.logger.log(`TOTP setup initiated for user: ${user.email}`);

    const qrCodeUrl = secret.otpauth_url;
    if (!qrCodeUrl) {
      throw new InternalServerErrorException(appError('MFA_FAILED'));
    }

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret.base32,
    };
  }

  async verifyTotpSetup(userId: string, token: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user?.mfaSettings) {
      throw new BadRequestException(appError('MFA_SETUP_NOT_FOUND'));
    }

    const totpMethod = user.mfaSettings.methods.find(
      method => method.type === 'totp' && !method.verified,
    );

    if (!totpMethod?.secret) {
      throw new BadRequestException(appError('MFA_METHOD_NOT_FOUND'));
    }

    const verified = speakeasy.totp.verify({
      secret: totpMethod.secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time windows for clock drift
    });

    if (verified) {
      // Activate TOTP method
      totpMethod.isActive = true;
      totpMethod.verified = true;
      user.mfaSettings.isEnabled = true;

      await user.save();

      this.logger.log(`TOTP setup completed for user: ${user.email}`);
      return true;
    }

    return false;
  }

  async verifyTotp(userId: string, token: string): Promise<MfaVerificationResult> {
    const user = await this.userModel.findById(userId);
    if (user?.mfaSettings?.isEnabled !== true) {
      throw new BadRequestException(appError('MFA_NOT_ENABLED'));
    }

    const totpMethod = user.mfaSettings.methods.find(
      method => method.type === 'totp' && method.isActive,
    );

    if (!totpMethod?.secret) {
      throw new BadRequestException(appError('MFA_METHOD_NOT_FOUND'));
    }

    // First try TOTP verification
    const verified = speakeasy.totp.verify({
      secret: totpMethod.secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      totpMethod.lastUsedAt = new Date();
      user.mfaSettings.lastAuthAt = new Date();
      await user.save();

      return { success: true };
    }

    // If TOTP fails, try backup codes
    return this.verifyBackupCode(user, token);
  }

  async verifyBackupCode(user: UserDocument, code: string): Promise<MfaVerificationResult> {
    if (!user.mfaSettings) {
      return { success: false };
    }

    const totpMethod = user.mfaSettings.methods.find(
      method => method.type === 'totp' && method.isActive,
    );

    if (!totpMethod?.backupCodes) {
      return { success: false };
    }

    // Check if any backup code matches
    for (let i = 0; i < totpMethod.backupCodes.length; i++) {
      const hashedCode = totpMethod.backupCodes[i];
      if (!hashedCode) {
        continue;
      }
      const isValid = await argon2.verify(hashedCode, code);

      if (isValid) {
        // Remove used backup code
        totpMethod.backupCodes.splice(i, 1);
        totpMethod.lastUsedAt = new Date();
        user.mfaSettings.lastAuthAt = new Date();

        await user.save();

        this.logger.log(`Backup code used for user: ${user.email}`);

        return {
          success: true,
          backupCodeUsed: true,
          remainingBackupCodes: totpMethod.backupCodes.length,
        };
      }
    }

    return { success: false };
  }

  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userModel.findById(userId);
    if (user?.mfaSettings?.isEnabled !== true) {
      throw new BadRequestException(appError('MFA_NOT_ENABLED'));
    }

    const totpMethod = user.mfaSettings.methods.find(
      method => method.type === 'totp' && method.isActive,
    );

    if (!totpMethod) {
      throw new BadRequestException(appError('MFA_METHOD_NOT_FOUND'));
    }

    const newBackupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      newBackupCodes.map(async code => {
        const hashed = await argon2.hash(code);
        return hashed;
      }),
    );

    totpMethod.backupCodes = hashedBackupCodes;
    await user.save();

    this.logger.log(`New backup codes generated for user: ${user.email}`);

    return newBackupCodes;
  }

  async disableMfa(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException(appError('USER_NOT_FOUND'));
    }

    if (user.mfaSettings) {
      user.mfaSettings.isEnabled = false;
      user.mfaSettings.methods = [];
      await user.save();
    }

    this.logger.log(`MFA disabled for user: ${user.email}`);
  }

  async getMfaStatus(userId: string): Promise<{
    isEnabled: boolean;
    methods: Array<{
      type: string;
      isActive: boolean;
      verified: boolean;
      createdAt: Date;
      lastUsedAt?: Date;
    }>;
    backupCodesCount?: number;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user?.mfaSettings) {
      return { isEnabled: false, methods: [] };
    }

    const methods = user.mfaSettings.methods.map(method => ({
      type: method.type,
      isActive: method.isActive,
      verified: method.verified,
      createdAt: method.createdAt,
      ...(method.lastUsedAt !== undefined ? { lastUsedAt: method.lastUsedAt } : {}),
    }));

    const totpMethod = user.mfaSettings.methods.find(
      method => method.type === 'totp' && method.isActive,
    );

    return {
      isEnabled: user.mfaSettings.isEnabled,
      methods,
      backupCodesCount: totpMethod?.backupCodes?.length ?? 0,
    };
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      const code =
        crypto
          .randomBytes(this.BACKUP_CODE_LENGTH / 2)
          .toString('hex')
          .toUpperCase()
          .match(/.{1,4}/g)
          ?.join('-') ?? '';
      codes.push(code);
    }
    return codes;
  }

  async requiresMfaForAction(userId: string, action: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (user?.mfaSettings?.isEnabled !== true) {
      return false;
    }

    const sensitiveActions = [
      'password_change',
      'email_change',
      'delete_account',
      'payment_method_add',
      'privacy_settings_change',
    ];

    return (
      user.mfaSettings.requireForSensitiveActions === true && sensitiveActions.includes(action)
    );
  }

  async validateMfaSession(userId: string, deviceId?: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (user?.mfaSettings?.isEnabled !== true) {
      return true;
    }

    // Check if device is trusted
    if (deviceId && user.trustedDevices !== null && user.trustedDevices !== undefined) {
      const trustedDevice = user.trustedDevices.find(
        device =>
          device.deviceId === deviceId &&
          device.isTrusted === true &&
          !device.revokedAt &&
          device.expiresAt !== undefined &&
          device.expiresAt > new Date(),
      );

      if (trustedDevice) {
        trustedDevice.lastUsedAt = new Date();
        await user.save();
        return true;
      }
    }

    // Check if MFA was recently verified
    if (user.mfaSettings.lastAuthAt) {
      const mfaValidUntil = new Date(
        user.mfaSettings.lastAuthAt.getTime() + 2 * 60 * 60 * 1000, // 2 hours
      );
      return new Date() < mfaValidUntil;
    }

    return false;
  }
}
