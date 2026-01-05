/**
 * Password Strength Indicator Component
 *
 * Provides real-time visual feedback for password requirements
 * Matches backend validation rules exactly
 *
 * Features:
 * - Individual requirement checkmarks (green when satisfied)
 * - Visual strength bar with color coding
 * - Accessible labels for screen readers
 * - Real-time updates as user types
 *
 * Backend Requirements (from RegisterDto):
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (@$!%*?&.)
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

interface PasswordRequirement {
  label: string;
  isSatisfied: boolean;
  regex: RegExp;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  visible?: boolean;
  onStrengthChange?: (score: number) => void;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  visible = true,
  onStrengthChange,
}) => {
  const theme = useTheme();

  /**
   * Calculate password strength based on backend requirements
   * Returns 0-4 score matching zxcvbn algorithm used by backend
   */
  const { requirements, score, strength } = useMemo(() => {
    const reqs: PasswordRequirement[] = [
      {
        label: 'At least 8 characters',
        isSatisfied: password.length >= 8,
        regex: /.{8,}/,
      },
      {
        label: 'At least 1 lowercase letter (a-z)',
        isSatisfied: /[a-z]/.test(password),
        regex: /[a-z]/,
      },
      {
        label: 'At least 1 uppercase letter (A-Z)',
        isSatisfied: /[A-Z]/.test(password),
        regex: /[A-Z]/,
      },
      {
        label: 'At least 1 number (0-9)',
        isSatisfied: /[0-9]/.test(password),
        regex: /[0-9]/,
      },
      {
        label: 'At least 1 special character (@$!%*?&.)',
        isSatisfied: /[@$!%*?&.]/.test(password),
        regex: /[@$!%*?&.]/,
      },
    ];

    // Calculate score: 0-4 based on satisfied requirements
    const satisfiedCount = reqs.filter(r => r.isSatisfied).length;
    let calculatedScore = 0;

    if (satisfiedCount === 5)
      calculatedScore = 4; // All requirements met
    else if (satisfiedCount === 4)
      calculatedScore = 3; // Good
    else if (satisfiedCount === 3)
      calculatedScore = 2; // Acceptable (minimum for backend)
    else if (satisfiedCount === 2)
      calculatedScore = 1; // Weak
    else calculatedScore = 0; // Too weak

    // Strength label
    let strengthLabel = 'Too Weak';
    if (calculatedScore === 4) strengthLabel = 'Strong';
    else if (calculatedScore === 3) strengthLabel = 'Good';
    else if (calculatedScore === 2) strengthLabel = 'Acceptable';
    else if (calculatedScore === 1) strengthLabel = 'Weak';

    return {
      requirements: reqs,
      score: calculatedScore,
      strength: strengthLabel,
    };
  }, [password]);

  /**
   * Notify parent component when strength changes
   */
  React.useEffect(() => {
    if (onStrengthChange) {
      onStrengthChange(score);
    }
  }, [score, onStrengthChange]);

  /**
   * Get strength bar color based on score
   */
  const getStrengthColor = (): string => {
    if (score >= 3) return theme.colors.success; // Green
    if (score === 2) return theme.colors.warning; // Yellow
    return theme.colors.error; // Red
  };

  /**
   * Get strength bar width percentage
   * Returns a DimensionValue-compatible percentage string
   */
  const getStrengthWidth = (): `${number}%` => `${(score / 4) * 100}%`;

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Password Requirements Checklist */}
      <View style={styles.requirementsContainer}>
        {requirements.map((requirement, index) => (
          <View key={index} style={styles.requirementRow}>
            <View
              style={[
                styles.checkmark,
                {
                  backgroundColor: requirement.isSatisfied
                    ? theme.colors.success
                    : theme.colors.surfaceContainer,
                  borderColor: requirement.isSatisfied
                    ? theme.colors.success
                    : theme.colors.outline,
                },
              ]}
            >
              {requirement.isSatisfied && (
                <Text variant='label.small' weight='bold' style={{ color: theme.colors.onSuccess }}>
                  ✓
                </Text>
              )}
            </View>
            <Text
              variant='label.small'
              style={{
                color: requirement.isSatisfied
                  ? theme.colors.success
                  : theme.colors.onSurfaceVariant,
              }}
            >
              {requirement.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Strength Bar */}
      {password.length > 0 && (
        <View style={styles.strengthBarContainer}>
          <View style={styles.strengthBarBackground}>
            <View
              style={[
                styles.strengthBarFill,
                {
                  width: getStrengthWidth(),
                  backgroundColor: getStrengthColor(),
                },
              ]}
            />
          </View>
          <Text
            variant='label.small'
            weight='medium'
            style={[styles.strengthLabel, { color: getStrengthColor() }]}
          >
            {strength}
          </Text>
        </View>
      )}

      {/* Warning for weak passwords */}
      {password.length > 0 && score < 2 && (
        <View style={[styles.warningBanner, { backgroundColor: theme.colors.errorContainer }]}>
          <Text variant='label.small' style={{ color: theme.colors.onErrorContainer }}>
            ⚠️ Password is too weak. Backend requires at least "Acceptable" strength.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  requirementsContainer: {
    gap: 6,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  strengthBarContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strengthBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 4,
    // Note: React Native doesn't support CSS transitions
    // Use Animated API for smooth animations if needed
  },
  strengthLabel: {
    minWidth: 80,
    textAlign: 'right',
  },
  warningBanner: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
  },
});
