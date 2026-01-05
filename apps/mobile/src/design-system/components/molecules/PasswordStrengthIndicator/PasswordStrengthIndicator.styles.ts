/**
 * PasswordStrengthIndicator Styles
 */

import { StyleSheet } from 'react-native';

import type { ThemeContextValue } from '../../../types';

export const createPasswordStrengthIndicatorStyles = (
  theme: ThemeContextValue,
  _dropdownMode = false,
) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginVertical: theme.spacing.md,
    },
    // Dropdown mode styles
    dropdownContainer: {
      width: '100%',
      marginTop: 0,
      zIndex: 1000,
    },
    dropdownCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 8,
      ...theme.shadows.component.card.elevated,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    dropdownRulesContainer: {
      gap: 3,
    },
    dropdownRuleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
    },
    dropdownRuleIconContainer: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    dropdownRuleText: {
      flex: 1,
      fontSize: 10,
      color: theme.colors.onSurface,
    },
    dropdownProgressBarContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
    },
    // Success cue banner (shown when all requirements are met)
    successCue: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: 6,
      borderRadius: 6,
      backgroundColor: 'rgba(76, 175, 80, 0.1)', // Light green background
      borderWidth: 1,
      borderColor: 'rgba(76, 175, 80, 0.3)', // Green border
    },
    successCueText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#2E7D32', // Dark green for contrast
      marginLeft: 6,
    },
    progressBarContainer: {
      marginBottom: theme.spacing.md,
    },
    progressBarLabel: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    strengthLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    strengthScore: {
      fontSize: 12,
      fontWeight: '500',
    },
    crackTimeText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xs,
      fontStyle: 'italic',
    },
    progressBarWrapper: {
      height: 8,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 4,
      overflow: 'hidden',
    },
    rulesContainer: {
      marginTop: theme.spacing.sm,
    },
    rulesSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.sm,
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: 6,
      marginBottom: theme.spacing.xs,
    },
    ruleItemMet: {
      backgroundColor: theme.colors.successContainer || 'rgba(76, 175, 80, 0.1)',
    },
    ruleItemUnmet: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    ruleIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
    },
    ruleText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.onSurface,
    },
    ruleTextMet: {
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
    ruleTextUnmet: {
      color: theme.colors.onSurfaceVariant,
    },
    checkIcon: {
      // Animated icon styles
    },
    feedbackContainer: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    feedbackText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    feedbackTextSuccess: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    feedbackTextError: {
      color: theme.colors.error,
    },
    feedbackTextWarning: {
      color: theme.colors.error, // Use error color as warning
    },
    basicRulesContainer: {
      marginBottom: theme.spacing.sm,
    },
    advancedRulesContainer: {
      marginTop: theme.spacing.xs,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
    },
    advancedRulesTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xs,
    },
    warningBanner: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.sm,
      borderRadius: 8,
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      flexDirection: 'row',
      alignItems: 'center',
    },
    warningBannerText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.onWarningContainer,
      marginLeft: theme.spacing.sm,
      lineHeight: 16,
    },
  });
