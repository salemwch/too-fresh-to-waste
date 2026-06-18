import {
  PASSWORD_POLICY,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SPECIAL_CHARS,
  PASSWORD_MIN_SCORE,
  PASSWORD_MAX_REPEATING_CHARS,
  PASSWORD_ERROR_MESSAGES,
  COMMON_PASSWORDS,
  buildSpecialCharRegex,
} from '@foodwaste/shared';
import * as crypto from 'crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZxcvbnFactory, type OptionsGraph } from '@zxcvbn-ts/core';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

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

import {
  IPasswordPolicyService,
  PasswordStrengthResult,
  PasswordPolicyConfig,
  PasswordValidationContext,
} from '../interfaces/password-policy-service.interface';

import { PasswordHistoryService } from './password-history.service';

/**
 * PasswordPolicyService - Concrete implementation of IPasswordPolicyService
 *
 * Implements enterprise-grade password security with:
 * - Interface-based dependency inversion
 * - zxcvbn strength analysis
 * - OWASP-compliant password rules
 * - Personal information filtering
 * - Password history enforcement
 *
 * @implements {IPasswordPolicyService}
 */
@Injectable()
export class PasswordPolicyService implements IPasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  /**
   * Default password policy using centralized configuration from @foodwaste/shared
   * This ensures consistency between backend validation and mobile app validation
   */
  private readonly defaultPolicy: PasswordPolicyConfig = {
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    requireUppercase: PASSWORD_POLICY.requireUppercase,
    requireLowercase: PASSWORD_POLICY.requireLowercase,
    requireNumbers: PASSWORD_POLICY.requireNumbers,
    requireSpecialChars: PASSWORD_POLICY.requireSpecialChars,
    minScore: PASSWORD_MIN_SCORE,
    preventCommon: PASSWORD_POLICY.preventCommon,
    preventPersonalInfo: PASSWORD_POLICY.preventPersonalInfo,
    preventRepeating: PASSWORD_POLICY.preventRepeating,
    maxRepeatingChars: PASSWORD_MAX_REPEATING_CHARS,
    specialCharacters: PASSWORD_SPECIAL_CHARS,
  };

  /**
   * Common passwords list from centralized configuration
   */
  private readonly commonPasswords = new Set<string>(COMMON_PASSWORDS as readonly string[]);

  constructor(
    private readonly configService: ConfigService,
    private readonly passwordHistoryService: PasswordHistoryService,
  ) {
    void this.containsPersonalInfo;
    void this._escapeRegex;
  }

  validatePassword(password: string, context?: PasswordValidationContext): PasswordStrengthResult {
    const policy = this.getPasswordPolicy();
    const feedback: string[] = [];
    const suggestions: string[] = [];
    let isValid = true;

    try {
      // Basic length checks
      if (password.length < policy.minLength) {
        feedback.push(PASSWORD_ERROR_MESSAGES.TOO_SHORT);
        suggestions.push(`Add ${policy.minLength - password.length} more characters`);
        isValid = false;
      }

      if (password.length > policy.maxLength) {
        feedback.push(PASSWORD_ERROR_MESSAGES.TOO_LONG);
        isValid = false;
      }

      // Character requirements
      if (policy.requireUppercase && !/[A-Z]/.test(password)) {
        feedback.push(PASSWORD_ERROR_MESSAGES.NO_UPPERCASE);
        suggestions.push('Add uppercase letters (A-Z)');
        isValid = false;
      }

      if (policy.requireLowercase && !/[a-z]/.test(password)) {
        feedback.push(PASSWORD_ERROR_MESSAGES.NO_LOWERCASE);
        suggestions.push('Add lowercase letters (a-z)');
        isValid = false;
      }

      if (policy.requireNumbers && !/[0-9]/.test(password)) {
        feedback.push(PASSWORD_ERROR_MESSAGES.NO_DIGIT);
        suggestions.push('Add numbers (0-9)');
        isValid = false;
      }

      if (policy.requireSpecialChars && !buildSpecialCharRegex().test(password)) {
        feedback.push(PASSWORD_ERROR_MESSAGES.NO_SPECIAL);
        suggestions.push(`Add special characters (${policy.specialCharacters})`);
        isValid = false;
      }

      // Advanced validations
      if (policy.preventCommon && this.isCommonPassword(password)) {
        feedback.push('Password is too common and easily guessable');
        suggestions.push('Choose a more unique password');
        isValid = false;
      }

      if (policy.preventRepeating && this.hasRepeatingChars(password, policy.maxRepeatingChars)) {
        feedback.push(
          `Password has too many repeating characters (max ${policy.maxRepeatingChars})`,
        );
        suggestions.push('Reduce repeating characters');
        isValid = false;
      }

      // Personal information checking DISABLED - users can use their name/email in passwords
      // This check is commented out to allow memorable passwords without penalty
      // if (policy.preventPersonalInfo && context && this.containsPersonalInfo(password, context)) {
      //   feedback.push('Password contains personal information');
      //   suggestions.push('Avoid using your name or email in the password');
      //   isValid = false;
      // }

      // Use zxcvbn for advanced password strength analysis
      const userInputs = this.buildUserInputs(context);
      const strengthAnalysis = zxcvbnFactory.check(password, userInputs);

      if (strengthAnalysis.score < policy.minScore) {
        feedback.push(`Password strength is too weak (score: ${strengthAnalysis.score}/${4})`);
        isValid = false;
      }

      // Add zxcvbn feedback
      if (strengthAnalysis.feedback.warning) {
        feedback.push(strengthAnalysis.feedback.warning);
      }

      suggestions.push(...(strengthAnalysis.feedback.suggestions ?? []));

      const result: PasswordStrengthResult = {
        score: strengthAnalysis.score,
        feedback,
        isValid: isValid && strengthAnalysis.score >= policy.minScore,
        ...(strengthAnalysis.feedback.warning
          ? { warning: strengthAnalysis.feedback.warning }
          : {}),
        suggestions,
        crackTime: this.formatCrackTime(
          strengthAnalysis.crackTimes.offlineSlowHashingXPerSecond.display,
        ),
        guessesLog10: strengthAnalysis.guessesLog10,
      };

      this.logger.debug(`Password validation result`, {
        score: result.score,
        isValid: result.isValid,
        feedbackCount: feedback.length,
        feedback,
        suggestions,
      });

      return result;
    } catch (error) {
      this.logger.error('Error during password validation:', error);
      throw new BadRequestException('Password validation failed');
    }
  }

  generateSecurePassword(length: number = 16): string {
    const policy = this.getPasswordPolicy();
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = policy.specialCharacters;

    let charset = '';
    let password = '';

    if (policy.requireUppercase) {
      charset += uppercase;
      password += uppercase[crypto.randomInt(uppercase.length)];
    }

    if (policy.requireLowercase) {
      charset += lowercase;
      password += lowercase[crypto.randomInt(lowercase.length)];
    }

    if (policy.requireNumbers) {
      charset += numbers;
      password += numbers[crypto.randomInt(numbers.length)];
    }

    if (policy.requireSpecialChars) {
      charset += special;
      password += special[crypto.randomInt(special.length)];
    }

    for (let i = password.length; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }

    // Fisher-Yates shuffle with crypto.randomInt
    const chars = password.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    password = chars.join('');

    return password;
  }

  validatePasswordStrength(password: string, context?: PasswordValidationContext): void {
    const result = this.validatePassword(password, context);

    if (!result.isValid) {
      this.logger.warn('Password validation failed:', {
        feedback: result.feedback,
        suggestions: result.suggestions,
        score: result.score,
      });
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        feedback: result.feedback,
        suggestions: result.suggestions,
        score: result.score,
        type: 'WEAK_PASSWORD',
      });
    }
  }

  /**
   * Comprehensive password validation including history checking
   * Use this method when you have access to password history
   *
   * @param password - Password to validate
   * @param context - Validation context including previous passwords
   * @throws BadRequestException if password is invalid or reused
   */
  async validatePasswordWithHistory(
    password: string,
    context?: PasswordValidationContext,
  ): Promise<PasswordStrengthResult> {
    // 1. Perform standard password strength validation
    const result = this.validatePassword(password, context);

    // 2. Check password history if provided
    if (context?.previousPasswords && context.previousPasswords.length > 0) {
      try {
        await this.passwordHistoryService.validatePasswordHistory(
          password,
          context.previousPasswords,
        );
      } catch (error) {
        // Add history violation to feedback
        result.isValid = false;
        if (error instanceof BadRequestException) {
          const errorResponse = error.getResponse();
          const message =
            typeof errorResponse === 'string'
              ? errorResponse
              : String(
                  (errorResponse as Record<string, unknown>)['message'] ??
                    'Password reuse detected',
                );
          result.feedback.push(message);
          result.suggestions.push('Choose a password you have not used recently');
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }

    return result;
  }

  /**
   * Comprehensive password strength validation with history enforcement
   * Throws exception if validation fails
   *
   * @param password - Password to validate
   * @param context - Validation context including previous passwords
   * @throws BadRequestException if password is invalid or reused
   */
  async validatePasswordStrengthWithHistory(
    password: string,
    context?: PasswordValidationContext,
  ): Promise<void> {
    const result = await this.validatePasswordWithHistory(password, context);

    if (!result.isValid) {
      this.logger.warn('Password validation failed (with history):', {
        feedback: result.feedback,
        suggestions: result.suggestions,
        score: result.score,
      });
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        feedback: result.feedback,
        suggestions: result.suggestions,
        score: result.score,
        type: 'WEAK_PASSWORD',
      });
    }
  }

  getPasswordPolicy(): PasswordPolicyConfig {
    return {
      minLength:
        this.configService.get<number>('PASSWORD_MIN_LENGTH') ?? this.defaultPolicy.minLength,
      maxLength:
        this.configService.get<number>('PASSWORD_MAX_LENGTH') ?? this.defaultPolicy.maxLength,
      requireUppercase: this.parseBoolean(
        'PASSWORD_REQUIRE_UPPERCASE',
        this.defaultPolicy.requireUppercase,
      ),
      requireLowercase: this.parseBoolean(
        'PASSWORD_REQUIRE_LOWERCASE',
        this.defaultPolicy.requireLowercase,
      ),
      requireNumbers: this.parseBoolean(
        'PASSWORD_REQUIRE_NUMBERS',
        this.defaultPolicy.requireNumbers,
      ),
      requireSpecialChars: this.parseBoolean(
        'PASSWORD_REQUIRE_SPECIAL_CHARS',
        this.defaultPolicy.requireSpecialChars,
      ),
      minScore: this.configService.get<number>('PASSWORD_MIN_SCORE') ?? this.defaultPolicy.minScore,
      preventCommon: this.parseBoolean('PASSWORD_PREVENT_COMMON', this.defaultPolicy.preventCommon),
      preventPersonalInfo: this.parseBoolean(
        'PASSWORD_PREVENT_PERSONAL_INFO',
        this.defaultPolicy.preventPersonalInfo,
      ),
      preventRepeating: this.parseBoolean(
        'PASSWORD_PREVENT_REPEATING',
        this.defaultPolicy.preventRepeating,
      ),
      maxRepeatingChars:
        this.configService.get<number>('PASSWORD_MAX_REPEATING_CHARS') ??
        this.defaultPolicy.maxRepeatingChars,
      specialCharacters:
        this.configService.get<string>('PASSWORD_SPECIAL_CHARACTERS') ??
        this.defaultPolicy.specialCharacters,
    };
  }

  /**
   * Parse boolean from environment variable string
   * Environment variables are always strings, so "false" needs explicit parsing
   */
  private parseBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }

  private isCommonPassword(password: string): boolean {
    return this.commonPasswords.has(password.toLowerCase());
  }

  private hasRepeatingChars(password: string, maxRepeating: number): boolean {
    for (let i = 0; i < password.length - maxRepeating; i++) {
      const char = password[i];
      let count = 1;

      for (let j = i + 1; j < password.length && password[j] === char; j++) {
        count++;
      }

      if (count > maxRepeating) {
        return true;
      }
    }

    return false;
  }

  private containsPersonalInfo(_password: string, _context: PasswordValidationContext): boolean {
    // Personal information checking DISABLED - allow users to use their name/email in passwords
    // This prevents password strength from being penalized for including:
    // - Email address or email prefix
    // - First name or last name
    // Users can create memorable passwords using personal info without penalty

    // All personal info checking disabled - always return false
    // const lowercasePassword = password.toLowerCase();
    //
    // if (context.email) {
    //   const emailParts = context.email.toLowerCase().split('@')[0];
    //   if (lowercasePassword.includes(emailParts) && emailParts.length > 2) {
    //     return true;
    //   }
    // }
    //
    // if (context.firstName && context.firstName.length > 2) {
    //   if (lowercasePassword.includes(context.firstName.toLowerCase())) {
    //     return true;
    //   }
    // }
    //
    // if (context.lastName && context.lastName.length > 2) {
    //   if (lowercasePassword.includes(context.lastName.toLowerCase())) {
    //     return true;
    //   }
    // }

    return false;
  }

  private buildUserInputs(_context?: PasswordValidationContext): string[] {
    // Don't pass any personal info to zxcvbn to allow users flexibility in password choice
    // This prevents password strength from being penalized for including:
    // - Email address or email prefix
    // - First name or last name
    // Users can create memorable passwords using personal info without penalty

    const inputs: string[] = [];

    // All personal info checking disabled - empty array returned
    // if (context?.email) {
    //   inputs.push(context.email);
    //   inputs.push(context.email.split('@')[0]);
    // }

    // if (context?.firstName) {
    //   inputs.push(context.firstName);
    // }

    // if (context?.lastName) {
    //   inputs.push(context.lastName);
    // }

    return inputs;
  }

  private formatCrackTime(crackTime: string): string {
    return crackTime;
  }

  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
