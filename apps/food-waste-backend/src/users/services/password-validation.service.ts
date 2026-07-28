import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import { ZxcvbnFactory, type ZxcvbnResult, type OptionsGraph } from '@zxcvbn-ts/core';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

import { USER_AUDIT_LOG_MAX } from '../../common/constants/document-limits.constant';
import { User, UserDocument } from '../schemas/user.schema';

// language-common main entry has a CJS decompress bug — load adjacency graphs directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
const adjacencyGraphs =
  require('@zxcvbn-ts/language-common/dist/adjacencyGraphs.json.cjs') as OptionsGraph;

const zxcvbnFactory = new ZxcvbnFactory({
  translations: zxcvbnEnPackage.translations,
  graphs: adjacencyGraphs,
  dictionary: {
    ...zxcvbnEnPackage.dictionary,
  },
});

export interface PasswordStrengthResult {
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  feedback: string[];
  warning: string;
  isAcceptable: boolean;
  crackTimeDisplay: string;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    noCommonPatterns: boolean;
    notInPasswordHistory: boolean;
    notSimilarToPersonalInfo: boolean;
  };
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  minScore: number; // Minimum zxcvbn score
  maxPasswordAge: number; // Days
  passwordHistoryCount: number;
  preventCommonPasswords: boolean;
  preventPersonalInfoInPassword: boolean;
  blacklistedPatterns: string[];
}

@Injectable()
export class PasswordValidationService {
  private readonly logger = new Logger(PasswordValidationService.name);

  private readonly defaultPolicy: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    minScore: 3, // Strong password required
    maxPasswordAge: 90, // 90 days
    passwordHistoryCount: 5, // Remember last 5 passwords
    preventCommonPasswords: false,
    preventPersonalInfoInPassword: false,
    blacklistedPatterns: [
      'password',
      'admin',
      'user',
      'login',
      'welcome',
      'foodwaste',
      'app',
      'mobile',
      'website',
    ],
  };

  // Common passwords to reject
  private readonly commonPasswords = new Set([
    'password',
    'password123',
    '12345678',
    'qwerty',
    'abc123',
    'password1',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'master',
    'shadow',
    'login',
    'football',
    'iloveyou',
    'superman',
    'michael',
    'ninja',
    'mustang',
  ]);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async validatePassword(
    password: string,
    userInfo?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
    },
    userId?: string,
    policy: PasswordPolicy = this.defaultPolicy,
  ): Promise<PasswordStrengthResult> {
    const result = this.initializeValidationResult();

    // Early return for invalid length
    if (!this.validatePasswordLength(password, policy, result)) {
      return result;
    }

    // Perform all validation checks
    this.validateCharacterComposition(password, policy, result);
    this.validateCommonPatterns(password, policy, result);
    this.validateBlacklistedPatterns(password, policy, result);
    this.validatePersonalInfo(password, userInfo, policy, result);
    await this.validatePasswordHistory(password, userId, result);
    this.performZxcvbnAnalysis(password, userInfo, result);
    this.determineAcceptability(result, policy);

    this.logger.debug(
      `Password validation completed. Score: ${result.score}, Acceptable: ${result.isAcceptable}`,
    );
    return result;
  }

  private initializeValidationResult(): PasswordStrengthResult {
    return {
      score: 0,
      feedback: [],
      warning: '',
      isAcceptable: false,
      crackTimeDisplay: '',
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        noCommonPatterns: false,
        notInPasswordHistory: false,
        notSimilarToPersonalInfo: false,
      },
    };
  }

  private validatePasswordLength(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): boolean {
    if (password.length < policy.minLength) {
      result.feedback.push(`Password must be at least ${policy.minLength} characters long`);
    } else {
      result.requirements.minLength = true;
    }

    if (password.length > policy.maxLength) {
      result.feedback.push(`Password must be no more than ${policy.maxLength} characters long`);
      return false;
    }

    return true;
  }

  private validateCharacterComposition(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    this.checkUppercase(password, policy, result);
    this.checkLowercase(password, policy, result);
    this.checkNumbers(password, policy, result);
    this.checkSpecialChars(password, policy, result);
  }

  private checkUppercase(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      result.feedback.push('Password must contain at least one uppercase letter');
    } else {
      result.requirements.hasUppercase = true;
    }
  }

  private checkLowercase(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      result.feedback.push('Password must contain at least one lowercase letter');
    } else {
      result.requirements.hasLowercase = true;
    }
  }

  private checkNumbers(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (policy.requireNumbers && !/\d/.test(password)) {
      result.feedback.push('Password must contain at least one number');
    } else {
      result.requirements.hasNumbers = true;
    }
  }

  private checkSpecialChars(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      result.feedback.push('Password must contain at least one special character');
    } else {
      result.requirements.hasSpecialChars = true;
    }
  }

  private validateCommonPatterns(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (!policy.preventCommonPasswords) {
      result.requirements.noCommonPatterns = true;
      return;
    }

    const lowerPassword = password.toLowerCase();
    if (this.commonPasswords.has(lowerPassword)) {
      result.feedback.push('Password is too common and easily guessable');
    } else {
      result.requirements.noCommonPatterns = true;
    }
  }

  private validateBlacklistedPatterns(
    password: string,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    const lowerPassword = password.toLowerCase();

    for (const pattern of policy.blacklistedPatterns) {
      if (lowerPassword.includes(pattern.toLowerCase())) {
        result.feedback.push(`Password cannot contain "${pattern}"`);
        result.requirements.noCommonPatterns = false;
        return;
      }
    }
  }

  private validatePersonalInfo(
    password: string,
    userInfo:
      | { email?: string; firstName?: string; lastName?: string; phoneNumber?: string }
      | undefined,
    policy: PasswordPolicy,
    result: PasswordStrengthResult,
  ): void {
    if (!policy.preventPersonalInfoInPassword || !userInfo) {
      result.requirements.notSimilarToPersonalInfo = true;
      return;
    }

    const personalInfoItems = this.extractPersonalInfo(userInfo);
    const containsPersonalInfo = this.checkForPersonalInfoInPassword(password, personalInfoItems);

    if (containsPersonalInfo) {
      result.feedback.push('Password cannot contain personal information');
      result.requirements.notSimilarToPersonalInfo = false;
    } else {
      result.requirements.notSimilarToPersonalInfo = true;
    }
  }

  private extractPersonalInfo(userInfo: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }): string[] {
    return [
      userInfo.email?.split('@')[0],
      userInfo.firstName,
      userInfo.lastName,
      userInfo.phoneNumber,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  private checkForPersonalInfoInPassword(password: string, personalInfoItems: string[]): boolean {
    const lowerPassword = password.toLowerCase();
    return personalInfoItems.some(info => lowerPassword.includes(info.toLowerCase()));
  }

  private async validatePasswordHistory(
    password: string,
    userId: string | undefined,
    result: PasswordStrengthResult,
  ): Promise<void> {
    if (!userId) {
      result.requirements.notInPasswordHistory = true;
      return;
    }

    const isInHistory = await this.isPasswordInHistory(userId, password);
    if (isInHistory) {
      result.feedback.push('Password cannot be one of your recent passwords');
    } else {
      result.requirements.notInPasswordHistory = true;
    }
  }

  private performZxcvbnAnalysis(
    password: string,
    userInfo:
      | { email?: string; firstName?: string; lastName?: string; phoneNumber?: string }
      | undefined,
    result: PasswordStrengthResult,
  ): void {
    const userInputs = this.buildUserInputsForZxcvbn(userInfo);
    const zxcvbnResult = zxcvbnFactory.check(password, userInputs);
    this.applyZxcvbnResults(zxcvbnResult, result);
  }

  private buildUserInputsForZxcvbn(
    userInfo:
      | { email?: string; firstName?: string; lastName?: string; phoneNumber?: string }
      | undefined,
  ): string[] {
    return userInfo
      ? [userInfo.email, userInfo.firstName, userInfo.lastName, userInfo.phoneNumber].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : [];
  }

  private applyZxcvbnResults(zxcvbnResult: ZxcvbnResult, result: PasswordStrengthResult): void {
    result.score = zxcvbnResult.score;
    result.crackTimeDisplay = zxcvbnResult.crackTimes.offlineSlowHashingXPerSecond.display;

    if (
      typeof zxcvbnResult.feedback.warning === 'string' &&
      zxcvbnResult.feedback.warning.length > 0
    ) {
      result.warning = zxcvbnResult.feedback.warning;
    }

    if (zxcvbnResult.feedback.suggestions.length > 0) {
      result.feedback.push(...zxcvbnResult.feedback.suggestions);
    }
  }

  private determineAcceptability(result: PasswordStrengthResult, policy: PasswordPolicy): void {
    const requirementsMet = Object.values(result.requirements).every(req => req === true);
    const scoreAcceptable = result.score >= policy.minScore;

    result.isAcceptable = requirementsMet && scoreAcceptable && result.feedback.length === 0;

    if (!scoreAcceptable) {
      result.feedback.push(
        `Password strength score (${result.score}/4) is below minimum required (${policy.minScore})`,
      );
    }
  }

  async isPasswordInHistory(userId: string, newPassword: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user?.securitySettings?.passwordHistory) {
      return false;
    }

    for (const hashedPassword of user.securitySettings.passwordHistory) {
      try {
        const isMatch = await argon2.verify(hashedPassword, newPassword);
        if (isMatch) {
          return true;
        }
      } catch (error) {
        this.logger.error('Error checking password history:', error);
      }
    }

    return false;
  }

  async addPasswordToHistory(userId: string, hashedPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return;
    }

    user.securitySettings ??= {
      passwordStrength: { score: 0, feedback: [] },
      securityQuestions: [],
      passwordHistory: [],
      loginNotifications: true,
      suspiciousActivityNotifications: true,
    };

    user.securitySettings.passwordHistory ??= [];

    // Add new password to history
    user.securitySettings.passwordHistory.unshift(hashedPassword);

    // Keep only the configured number of historical passwords
    const maxHistory = this.defaultPolicy.passwordHistoryCount;
    if (user.securitySettings.passwordHistory.length > maxHistory) {
      user.securitySettings.passwordHistory = user.securitySettings.passwordHistory.slice(
        0,
        maxHistory,
      );
    }

    // Update last password change timestamp
    user.securitySettings.lastPasswordChange = new Date();

    await user.save();

    this.logger.log(`Password history updated for user: ${user.email}`);
  }

  async updatePasswordStrength(
    userId: string,
    passwordStrength: PasswordStrengthResult,
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return;
    }

    user.securitySettings ??= {
      passwordStrength: { score: 0, feedback: [] },
      securityQuestions: [],
      passwordHistory: [],
      loginNotifications: true,
      suspiciousActivityNotifications: true,
    };

    user.securitySettings.passwordStrength = {
      score: passwordStrength.score,
      feedback: passwordStrength.feedback,
      lastChecked: new Date(),
    };

    await user.save();
  }

  async checkPasswordAge(userId: string): Promise<{
    needsChange: boolean;
    daysUntilExpiry: number;
    lastChanged?: Date | undefined;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user?.securitySettings?.lastPasswordChange) {
      return {
        needsChange: true,
        daysUntilExpiry: 0,
        lastChanged: undefined,
      };
    }

    const lastChanged = user.securitySettings.lastPasswordChange;
    const daysSinceChange = Math.floor(
      (new Date().getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24),
    );

    const daysUntilExpiry = this.defaultPolicy.maxPasswordAge - daysSinceChange;
    const needsChange = daysUntilExpiry <= 0;

    return {
      needsChange,
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
      lastChanged,
    };
  }

  async setRequiredPasswordChange(userId: string, reason: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return;
    }

    user.securitySettings ??= {
      passwordStrength: { score: 0, feedback: [] },
      securityQuestions: [],
      passwordHistory: [],
      loginNotifications: true,
      suspiciousActivityNotifications: true,
    };

    user.securitySettings.requirePasswordChangeAt = new Date();

    // Add audit log entry
    user.auditLog ??= [];

    user.auditLog.unshift({
      action: 'PASSWORD_CHANGE_REQUIRED',
      timestamp: new Date(),
      ipAddress: '', // Would come from request context
      userAgent: '', // Would come from request context
      details: { reason },
    });

    if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
      user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
    }

    await user.save();

    this.logger.log(`Password change required for user: ${user.email}, Reason: ${reason}`);
  }

  getPasswordPolicy(): PasswordPolicy {
    return { ...this.defaultPolicy };
  }

  generatePasswordSuggestion(): string {
    const adjectives = ['Quick', 'Bright', 'Silent', 'Swift', 'Brave', 'Calm', 'Bold', 'Safe'];
    const nouns = ['River', 'Mountain', 'Ocean', 'Forest', 'Garden', 'Bridge', 'Castle', 'Tower'];
    const numbers = Math.floor(Math.random() * 999) + 100;
    const symbols = ['!', '@', '#', '$', '%', '&', '*'];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    return `${adjective}${noun}${numbers}${symbol}`;
  }

  async getPasswordSecurityReport(userId: string): Promise<{
    currentStrength: PasswordStrengthResult;
    passwordAge: { needsChange: boolean; daysUntilExpiry: number; lastChanged?: Date | undefined };
    historyCount: number;
    recommendations: string[];
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const passwordAge = await this.checkPasswordAge(userId);
    const historyCount = user.securitySettings?.passwordHistory?.length ?? 0;

    const currentStrength = user.securitySettings?.passwordStrength
      ? {
          score: user.securitySettings.passwordStrength.score,
          feedback: user.securitySettings.passwordStrength.feedback,
          warning: '',
          isAcceptable: user.securitySettings.passwordStrength.score >= 3,
          crackTimeDisplay: '',
          requirements: {
            minLength: true,
            hasUppercase: true,
            hasLowercase: true,
            hasNumbers: true,
            hasSpecialChars: true,
            noCommonPatterns: true,
            notInPasswordHistory: true,
            notSimilarToPersonalInfo: true,
          },
        }
      : {
          score: 0,
          feedback: ['Password strength unknown - consider updating your password'],
          warning: 'Password needs evaluation',
          isAcceptable: false,
          crackTimeDisplay: 'Unknown',
          requirements: {
            minLength: false,
            hasUppercase: false,
            hasLowercase: false,
            hasNumbers: false,
            hasSpecialChars: false,
            noCommonPatterns: false,
            notInPasswordHistory: false,
            notSimilarToPersonalInfo: false,
          },
        };

    const recommendations: string[] = [];

    if (passwordAge.needsChange) {
      recommendations.push('Your password has expired and needs to be changed');
    } else if (passwordAge.daysUntilExpiry <= 7) {
      recommendations.push(`Your password expires in ${passwordAge.daysUntilExpiry} days`);
    }

    if (currentStrength.score < 3) {
      recommendations.push('Consider using a stronger password');
    }

    if (user.mfaSettings?.isEnabled !== true) {
      recommendations.push('Enable multi-factor authentication for better security');
    }

    if (historyCount < 3) {
      recommendations.push('Password history is building up - change your password regularly');
    }

    return {
      currentStrength,
      passwordAge,
      historyCount,
      recommendations,
    };
  }
}
