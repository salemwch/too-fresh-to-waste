/**
 * Password strength analysis result
 */
export interface PasswordStrengthResult {
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  feedback: string[];
  isValid: boolean;
  warning?: string;
  suggestions: string[];
  crackTime: string;
  guessesLog10: number;
}

/**
 * Password policy configuration
 */
export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  minScore: number; // Minimum zxcvbn score (0-4)
  preventCommon: boolean;
  preventPersonalInfo: boolean;
  preventRepeating: boolean;
  maxRepeatingChars: number;
  specialCharacters: string;
}

/**
 * Context for password validation
 */
export interface PasswordValidationContext {
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Array of hashed previous passwords for history validation */
  previousPasswords?: string[];
}

/**
 * Interface for Password Policy Service
 *
 * Abstraction layer for password policy enforcement and validation.
 * Enables dependency inversion and facilitates testing with mocks.
 *
 * @enterprise-pattern Dependency Inversion Principle (SOLID)
 * @testing Enables testing without actual zxcvbn library overhead
 */
export interface IPasswordPolicyService {
  /**
   * Validate password against policy
   * @param password Password to validate
   * @param context Validation context (user info for personal data checks)
   * @returns Password strength result with feedback
   */
  validatePassword(
    password: string,
    context?: PasswordValidationContext
  ): PasswordStrengthResult;

  /**
   * Validate password strength and throw exception if invalid
   * @param password Password to validate
   * @param context Validation context
   * @throws BadRequestException if password is invalid
   */
  validatePasswordStrength(
    password: string,
    context?: PasswordValidationContext
  ): void;

  /**
   * Validate password with history checking
   * @param password Password to validate
   * @param context Validation context including password history
   * @returns Password strength result
   */
  validatePasswordWithHistory(
    password: string,
    context?: PasswordValidationContext
  ): Promise<PasswordStrengthResult>;

  /**
   * Validate password with history and throw exception if invalid
   * @param password Password to validate
   * @param context Validation context including password history
   * @throws BadRequestException if password is invalid or reused
   */
  validatePasswordStrengthWithHistory(
    password: string,
    context?: PasswordValidationContext
  ): Promise<void>;

  /**
   * Generate a secure password meeting policy requirements
   * @param length Desired password length (default: 16)
   * @returns Generated password
   */
  generateSecurePassword(length?: number): string;

  /**
   * Get current password policy configuration
   * @returns Password policy configuration
   */
  getPasswordPolicy(): PasswordPolicyConfig;
}

/**
 * Injection token for IPasswordPolicyService
 * Use this token in constructor injection instead of the concrete class
 *
 * @example
 * constructor(@Inject(PASSWORD_POLICY_SERVICE_TOKEN) private readonly passwordPolicyService: IPasswordPolicyService) {}
 */
export const PASSWORD_POLICY_SERVICE_TOKEN = Symbol('IPasswordPolicyService');
