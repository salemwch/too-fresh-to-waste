/**
 * Centralized Password Policy Configuration
 *
 * This is the single source of truth for password validation rules across the entire application.
 * Used by both backend (NestJS) and mobile (React Native) to ensure consistent validation.
 *
 * ⚠️ CRITICAL: Any changes here automatically propagate to:
 * - Backend API validation (RegisterDto, PasswordPolicyService)
 * - Mobile app validation (usePasswordRules, PasswordStrengthIndicator)
 * - User-facing error messages
 *
 * @module shared/validation/password-policy
 * @since 1.0.0
 */

// ============================================================================
// Password Length Requirements
// ============================================================================

/**
 * Minimum password length in characters
 * Industry standard: 8-12 characters minimum
 * NIST recommends at least 8 characters
 */
export const PASSWORD_MIN_LENGTH = 12 as const;

/**
 * Maximum password length in characters
 * Prevents potential DoS attacks from extremely long passwords
 */
export const PASSWORD_MAX_LENGTH = 128 as const;

// ============================================================================
// Character Requirements
// ============================================================================

/**
 * Special characters allowed in passwords
 *
 * Carefully selected to:
 * - Be available on all keyboards (international support)
 * - Not cause issues in URLs or databases
 * - Meet common security requirements
 * - Avoid regex character class range bugs (no unescaped hyphens)
 *
 * Characters: @ $ ! % * ? & .
 *
 * ⚠️ IMPORTANT: Order matters for regex escaping
 * - Characters that need escaping in regex: $ * ? .
 * - Safe characters: @ ! % &
 */
export const PASSWORD_SPECIAL_CHARS = '@$!%*?&.' as const;

/**
 * Uppercase letters pattern
 */
export const PASSWORD_UPPERCASE_PATTERN = '[A-Z]' as const;

/**
 * Lowercase letters pattern
 */
export const PASSWORD_LOWERCASE_PATTERN = '[a-z]' as const;

/**
 * Digit pattern
 */
export const PASSWORD_DIGIT_PATTERN = '[0-9]' as const;

// ============================================================================
// Regex Building Utilities
// ============================================================================

/**
 * Escape special characters for use in regex character class
 * Handles: $ * ? . ^ - ] \
 *
 * @param str - String containing special characters
 * @returns Escaped string safe for regex character class
 */
export function escapeRegexCharClass(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Backslash first
    .replace(/\]/g, '\\]') // Closing bracket
    .replace(/\^/g, '\\^') // Caret
    .replace(/-/g, '\\-') // Hyphen (prevents unintended ranges)
    .replace(/\$/g, '\\$') // Dollar sign
    .replace(/\*/g, '\\*') // Asterisk
    .replace(/\?/g, '\\?') // Question mark
    .replace(/\./g, '\\.'); // Period/dot
}

/**
 * Build regex pattern for password validation
 * Uses positive lookahead assertions for each requirement
 *
 * Pattern explanation:
 * - ^                                Start of string
 * - (?=.*[a-z])                      At least one lowercase
 * - (?=.*[A-Z])                      At least one uppercase
 * - (?=.*\d)                         At least one digit
 * - (?=.*[escapedSpecialChars])      At least one special char
 * - [A-Za-z\d{escapedSpecialChars}]+ Only allowed characters
 * - $                                End of string
 *
 * @returns RegExp object for password validation
 */
export function buildPasswordRegex(): RegExp {
  const escapedSpecialChars = escapeRegexCharClass(PASSWORD_SPECIAL_CHARS);

  return new RegExp(
    `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[${escapedSpecialChars}])[A-Za-z\\d${escapedSpecialChars}]+$`,
  );
}

/**
 * Build regex pattern for checking if password contains at least one special character
 * Used by PasswordPolicyService for modular validation
 *
 * @returns RegExp object that matches any special character
 */
export function buildSpecialCharRegex(): RegExp {
  const escapedSpecialChars = escapeRegexCharClass(PASSWORD_SPECIAL_CHARS);
  return new RegExp(`[${escapedSpecialChars}]`);
}

// ============================================================================
// Advanced Policy Settings
// ============================================================================

/**
 * Minimum password strength score (zxcvbn scale 0-4)
 * - 0: Very weak
 * - 1: Weak
 * - 2: Fair (recommended minimum)
 * - 3: Good
 * - 4: Excellent
 */
export const PASSWORD_MIN_SCORE = 2 as const;

/**
 * Maximum consecutive repeating characters allowed
 * Example: "aaa" has 3 repeating 'a', "aa" has 2
 */
export const PASSWORD_MAX_REPEATING_CHARS = 2 as const;

/**
 * Common passwords to reject (matching backend PasswordPolicyService)
 * These are frequently used passwords that should be blocked
 */
export const COMMON_PASSWORDS = [
  'password',
  '123456',
  '123456789',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'iloveyou',
  'princess',
  'rockyou',
  'football',
  'baseball',
  'sunshine',
  'master',
  'shadow',
  'michael',
  'superman',
  'batman',
  '123abc',
  'welcome123',
] as const;

// ============================================================================
// Policy Configuration Object
// ============================================================================

/**
 * Complete password policy configuration
 * This object is the single source of truth for all password validation
 */
export const PASSWORD_POLICY = {
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialCharacters: PASSWORD_SPECIAL_CHARS,
  minScore: PASSWORD_MIN_SCORE,
  maxRepeatingChars: PASSWORD_MAX_REPEATING_CHARS,
  preventCommon: true,
  preventPersonalInfo: false, // Allow users to use their name in passwords
  preventRepeating: true,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type-safe password policy configuration
 */
export type PasswordPolicyConfig = typeof PASSWORD_POLICY;

/**
 * Extract special characters as union type
 * Useful for type-safe character validation
 */
export type SpecialCharacter = (typeof PASSWORD_SPECIAL_CHARS)[number];

// ============================================================================
// Validation Messages
// ============================================================================

/**
 * User-facing error messages for password validation
 * Consistent messaging across backend API and mobile app
 */
export const PASSWORD_ERROR_MESSAGES = {
  TOO_SHORT: 'Password must be at least 12 characters long',
  TOO_LONG: `Password must be no more than ${PASSWORD_MAX_LENGTH} characters long`,
  NO_UPPERCASE: 'Password must contain at least one uppercase letter (A-Z)',
  NO_LOWERCASE: 'Password must contain at least one lowercase letter (a-z)',
  NO_DIGIT: 'Password must contain at least one number (0-9)',
  NO_SPECIAL: `Password must contain at least one special character (${PASSWORD_SPECIAL_CHARS})`,
  TOO_COMMON: 'Password is too common and easily guessable',
  TOO_MANY_REPEATING: `Password has too many repeating characters (max ${PASSWORD_MAX_REPEATING_CHARS} consecutive)`,
  HAS_PERSONAL_INFO: 'Password contains personal information (name or email)',
  TOO_WEAK: 'Password strength is too weak',
} as const;

// ============================================================================
// Exports
// ============================================================================
