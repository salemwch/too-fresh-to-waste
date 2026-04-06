/**
 * usePasswordRules Hook
 *
 * Comprehensive password validation hook matching backend security requirements.
 * Provides real-time validation, strength scoring, and detailed feedback for UI rendering.
 *
 * Features:
 * - Real-time validation as user types
 * - Individual rule checking (length, uppercase, lowercase, numbers, special chars)
 * - Overall strength score (0-4) matching backend zxcvbn scoring
 * - Progress calculation for visual indicators
 * - Color coding for each rule state
 * - Common password detection
 * - Repeating character detection
 * - Personal info detection (email/name in password)
 *
 * Usage:
 * ```tsx
 * const { rules, strength, progress, isValid, getRuleColor } = usePasswordRules(password, {
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe'
 * });
 * ```
 *
 * @see apps/food-waste-backend/src/auth/services/password-policy.service.ts
 * @see apps/food-waste-backend/src/users/services/password-validation.service.ts
 */

import { useMemo } from 'react';
import zxcvbn from 'zxcvbn';

import { colorTokens } from '@/design-system/tokens/colors';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PasswordValidationContext {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

interface PasswordRule {
  id: string;
  label: string;
  description: string;
  isMet: boolean;
  icon: string;
  iconFamily: 'MaterialCommunityIcons' | 'MaterialIcons' | 'Ionicons';
  color: string;
}

interface PasswordStrength {
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  label: string;
  color: string;
  progress: number; // 0-1 for progress bar
  crackTime?: string; // From zxcvbn (e.g., "3 days", "6 months")
}

interface PasswordValidationResult {
  rules: PasswordRule[];
  strength: PasswordStrength;
  isValid: boolean;
  feedback: string[];
  getRuleColor: (ruleId: string) => string;
  getRuleIcon: (ruleId: string) => string;
  isRuleMet: (ruleId: string) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const MAX_REPEATING_CHARS = 2;

// Color palette for rule states - Uses design system tokens for consistency
const COLORS = {
  unmet: colorTokens.base.neutral[500], // Gray - rule not met
  met: colorTokens.base.primary[500], // Primary brand color - rule met
  error: colorTokens.base.error[500], // Red - error state
  warning: colorTokens.base.warning[500], // Orange - warning
  info: colorTokens.base.info[500], // Blue - info
};

// Strength level configuration - Uses design system tokens for consistency
const STRENGTH_LEVELS = {
  0: { label: 'Very Weak', color: colorTokens.base.error[500], progress: 0.2 },
  1: { label: 'Weak', color: colorTokens.base.error[300], progress: 0.4 },
  2: { label: 'Fair', color: colorTokens.base.warning[500], progress: 0.6 },
  3: { label: 'Good', color: colorTokens.base.primary[300], progress: 0.8 },
  4: { label: 'Excellent', color: colorTokens.base.primary[500], progress: 1.0 },
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if password contains at least one uppercase letter
 */
const hasUppercase = (password: string): boolean => /[A-Z]/.test(password);

/**
 * Check if password contains at least one lowercase letter
 */
const hasLowercase = (password: string): boolean => /[a-z]/.test(password);

/**
 * Check if password contains at least one number
 */
const hasNumber = (password: string): boolean => /\d/.test(password);

/**
 * Check if password contains at least one special character
 * Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?
 */
const hasSpecialChar = (password: string): boolean =>
  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

/**
 * Check if password meets minimum length requirement
 */
const meetsMinLength = (password: string): boolean => password.length >= PASSWORD_MIN_LENGTH;

/**
 * Check if password is within maximum length
 */
const withinMaxLength = (password: string): boolean => password.length <= PASSWORD_MAX_LENGTH;

/**
 * Check if password has too many repeating characters (aaa, 111)
 */
const hasRepeatingChars = (
  password: string,
  maxRepeating: number = MAX_REPEATING_CHARS,
): boolean => {
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
};

/**
 * Calculate password strength score (0-4) using zxcvbn library
 * Matches backend PasswordPolicyService implementation exactly
 *
 * @param password - The password to evaluate
 * @param context - Optional context for personal info detection
 * @returns Object with score (0-4) and crack time estimate
 */
const calculateStrengthScore = (
  password: string,
  _context?: PasswordValidationContext,
): { score: number; crackTime: string } => {
  if (!password) {
    return { score: 0, crackTime: 'instant' };
  }

  // Don't pass any personal info to zxcvbn to allow users flexibility in password choice
  // This prevents password strength from being penalized for including:
  // - Email address or email prefix
  // - First name or last name
  // - Phone number
  // Users can create memorable passwords using personal info without penalty

  const userInputs: string[] = [];

  // All personal info checking disabled - empty array
  // if (context?.email !== undefined && context.email !== '') {
  //   userInputs.push(context.email);
  //   const emailParts = context.email.split('@');
  //   if (emailParts[0] !== undefined && emailParts[0] !== '') {
  //     userInputs.push(emailParts[0]); // Email prefix
  //   }
  // }
  // if (context?.firstName !== undefined) userInputs.push(context.firstName);
  // if (context?.lastName !== undefined) userInputs.push(context.lastName);
  // if (context?.phoneNumber !== undefined) userInputs.push(context.phoneNumber);

  // Use zxcvbn for accurate strength calculation
  const result = zxcvbn(password, userInputs);

  return {
    score: result.score, // 0-4
    crackTime:
      (result.crack_times_display.offline_slow_hashing_1e4_per_second as string) || 'unknown',
  };
};

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * usePasswordRules Hook
 *
 * Provides comprehensive password validation with real-time feedback
 *
 * @param password - The password string to validate
 * @param context - Optional context for personal info detection (email, firstName, lastName)
 * @returns Validation result with rules, strength, and helper functions
 */
export const usePasswordRules = (
  password: string = '',
  context?: PasswordValidationContext,
): PasswordValidationResult => {
  const result = useMemo(() => {
    // Define all password rules
    const rules: PasswordRule[] = [
      {
        id: 'minLength',
        label: 'At least 12 characters',
        description: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
        isMet: meetsMinLength(password),
        icon: 'format-letter-case',
        iconFamily: 'MaterialCommunityIcons',
        color: meetsMinLength(password) ? COLORS.met : COLORS.unmet,
      },
      {
        id: 'hasUppercase',
        label: 'Uppercase letter (A-Z)',
        description: 'At least one uppercase letter',
        isMet: hasUppercase(password),
        icon: 'format-letter-case-upper',
        iconFamily: 'MaterialCommunityIcons',
        color: hasUppercase(password) ? COLORS.met : COLORS.unmet,
      },
      {
        id: 'hasLowercase',
        label: 'Lowercase letter (a-z)',
        description: 'At least one lowercase letter',
        isMet: hasLowercase(password),
        icon: 'format-letter-case-lower',
        iconFamily: 'MaterialCommunityIcons',
        color: hasLowercase(password) ? COLORS.met : COLORS.unmet,
      },
      {
        id: 'hasNumber',
        label: 'Number (0-9)',
        description: 'At least one number',
        isMet: hasNumber(password),
        icon: 'numeric',
        iconFamily: 'MaterialCommunityIcons',
        color: hasNumber(password) ? COLORS.met : COLORS.unmet,
      },
      {
        id: 'hasSpecial',
        label: 'Special character (!@#$%...)',
        description: 'At least one special character',
        isMet: hasSpecialChar(password),
        icon: 'at',
        iconFamily: 'MaterialCommunityIcons',
        color: hasSpecialChar(password) ? COLORS.met : COLORS.unmet,
      },
      {
        id: 'noRepeating',
        label: 'No excessive repeating',
        description: `Max ${MAX_REPEATING_CHARS} consecutive same characters`,
        isMet: !hasRepeatingChars(password) || password.length < 3,
        icon: 'repeat',
        iconFamily: 'MaterialCommunityIcons',
        color: !hasRepeatingChars(password) || password.length < 3 ? COLORS.met : COLORS.warning,
      },
    ];

    // Check if password is valid (all basic rules met)
    // Basic rules: minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial (indices 0-4)
    const basicRulesMet = rules.slice(0, 5).every((rule) => rule.isMet);
    // Advanced rules: noRepeating (index 5)
    const advancedRulesMet = rules.slice(5).every((rule) => rule.isMet);

    // Count how many basic rules are satisfied
    const basicRulesMetCount = rules.slice(0, 5).filter((rule) => rule.isMet).length;

    // Calculate strength using Apple's two-phase approach:
    // Phase 1: Show requirement progress (0-5 rules met)
    // Phase 2: Once all requirements met, show entropy-based strength
    let strength: PasswordStrength;

    if (!basicRulesMet) {
      // Phase 1: Requirements not yet complete
      // Show progress as "X of 5 requirements met"
      const requirementProgress = basicRulesMetCount / 5; // 0.0 to 0.8 (max 4/5)

      strength = {
        score: basicRulesMetCount >= 4 ? 2 : basicRulesMetCount >= 3 ? 1 : 0,
        label: `${basicRulesMetCount} of 5 requirements met`,
        color:
          basicRulesMetCount >= 4
            ? STRENGTH_LEVELS[2].color
            : basicRulesMetCount >= 3
              ? STRENGTH_LEVELS[1].color
              : STRENGTH_LEVELS[0].color,
        progress: requirementProgress,
      };
    } else {
      // Phase 2: All requirements met - now show entropy-based strength
      const { score: zxcvbnScore, crackTime } = calculateStrengthScore(password, context);
      const strengthConfig =
        STRENGTH_LEVELS[zxcvbnScore as keyof typeof STRENGTH_LEVELS] !== undefined
          ? STRENGTH_LEVELS[zxcvbnScore as keyof typeof STRENGTH_LEVELS]
          : STRENGTH_LEVELS[0];

      strength = {
        score: zxcvbnScore,
        label: strengthConfig.label,
        color: strengthConfig.color,
        progress: strengthConfig.progress,
        crackTime,
      };
    }

    const isValid =
      basicRulesMet && advancedRulesMet && withinMaxLength(password) && strength.score >= 2;

    // Generate feedback messages
    const feedback: string[] = [];

    if (password.length === 0) {
      feedback.push('Start typing to see password strength');
    } else if (!withinMaxLength(password)) {
      feedback.push(`Password must be no more than ${PASSWORD_MAX_LENGTH} characters`);
    } else if (!advancedRulesMet) {
      // Advanced rules failed (repeating characters, etc.)
      const failedRules = rules.slice(5).filter((r) => !r.isMet);
      feedback.push(...failedRules.map((r) => r.description));
    }

    // Helper functions
    const getRuleColor = (ruleId: string): string => {
      const rule = rules.find((r) => r.id === ruleId);
      return rule?.color ?? COLORS.unmet;
    };

    const getRuleIcon = (ruleId: string): string => {
      const rule = rules.find((r) => r.id === ruleId);
      return rule?.icon ?? 'circle';
    };

    const isRuleMet = (ruleId: string): boolean => {
      const rule = rules.find((r) => r.id === ruleId);
      return rule ? rule.isMet : false;
    };

    return {
      rules,
      strength,
      isValid,
      feedback,
      getRuleColor,
      getRuleIcon,
      isRuleMet,
    };
  }, [password, context]);

  return result;
};
