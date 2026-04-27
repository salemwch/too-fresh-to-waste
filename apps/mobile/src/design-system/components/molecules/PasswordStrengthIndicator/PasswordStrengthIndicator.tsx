/**
 * PasswordStrengthIndicator Component
 *
 * Displays real-time password strength validation with visual feedback.
 *
 * Features:
 * - Progress bar showing overall password strength (0-100%)
 * - Individual rule indicators with check icons
 * - Haptic feedback when rules are met
 * - Smooth color animations using react-native-reanimated
 * - Detailed feedback messages
 * - Support for basic and advanced rules
 *
 * @example
 * ```tsx
 * <PasswordStrengthIndicator
 *   password={password}
 *   onValidityChange={(isValid) => console.log('Valid:', isValid)}
 *   onStrengthChange={(score) => console.log('Score:', score)}
 * />
 * ```
 */

import Icon from '@react-native-vector-icons/ionicons';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Animated, type ViewStyle, type TextStyle } from 'react-native';
import { trigger as triggerHaptic } from 'react-native-haptic-feedback';
import * as Progress from 'react-native-progress';

import { usePasswordRules } from '../../../../hooks';
import { useTheme } from '../../../providers';
import { Text } from '../../atoms/Text';

import { createPasswordStrengthIndicatorStyles } from './PasswordStrengthIndicator.styles';

import type { PasswordStrengthIndicatorProps } from './PasswordStrengthIndicator.types';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  context,
  showRules = true,
  showStrength = true,
  showProgressBar = true,
  showFeedback = true,
  enableHaptic = true,
  enableAnimations = true,
  dropdownMode = false,
  autoHideWhenValid = true,
  autoHideDelay = 1750,
  showSuccessCue = true,
  onValidityChange,
  onStrengthChange,
  containerStyle,
  progressBarStyle,
  ruleItemStyle,
  ruleTextStyle,
  feedbackTextStyle,
  testID,
}) => {
  const theme = useTheme();
  const styles = createPasswordStrengthIndicatorStyles(theme, dropdownMode);

  // Get password validation result from custom hook
  const { rules, strength, isValid, feedback } = usePasswordRules(password, context);

  // Track previous states for haptic feedback
  const previousValidityRef = useRef(isValid);
  const previousRulesRef = useRef<string[]>([]);
  const previousStrengthRef = useRef(strength.score);

  // Animation values for progress bar
  const [progressAnim] = useState(() => new Animated.Value(0));

  // Animation values for dropdown mode
  const [dropdownOpacity] = useState(() => new Animated.Value(0));
  const [dropdownTranslateY] = useState(() => new Animated.Value(-10));

  // Auto-hide delay timer
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedAutoHideKey, setElapsedAutoHideKey] = useState<string | null>(null);
  const autoHideKey =
    dropdownMode === true && autoHideWhenValid === true && isValid && password.length > 0
      ? password
      : null;
  const isPendingAutoHide = autoHideKey !== null && elapsedAutoHideKey !== autoHideKey;

  // Trigger haptic feedback when rules are met
  useEffect(() => {
    if (!enableHaptic || !password) return;

    // Check which rules were just met
    const metRules = rules.filter(rule => rule.isMet).map(rule => rule.id);
    const newlyMetRules = metRules.filter(id => !previousRulesRef.current.includes(id));

    // Trigger haptic for each newly met rule
    if (newlyMetRules.length > 0) {
      triggerHaptic('impactLight', hapticOptions);
    }

    // Trigger stronger haptic when all basic rules are met
    const basicRules = rules.slice(0, 5);
    const allBasicMet = basicRules.every(rule => rule.isMet);
    const previouslyNotAllMet = !previousRulesRef.current.includes('allBasicMet');

    if (allBasicMet && previouslyNotAllMet) {
      triggerHaptic('notificationSuccess', hapticOptions);
      previousRulesRef.current.push('allBasicMet');
    }

    previousRulesRef.current = metRules;
  }, [rules, enableHaptic, password]);

  // Trigger haptic when validity changes
  useEffect(() => {
    if (!enableHaptic || !password) return;

    if (isValid && !previousValidityRef.current) {
      // Password became valid
      triggerHaptic('notificationSuccess', hapticOptions);
    }

    previousValidityRef.current = isValid;
  }, [isValid, enableHaptic, password]);

  // Notify parent of validity changes
  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  // Notify parent of strength changes
  useEffect(() => {
    if (strength.score !== previousStrengthRef.current) {
      onStrengthChange?.(strength.score);
      previousStrengthRef.current = strength.score;
    }
  }, [strength.score, onStrengthChange]);

  // Animate progress bar
  useEffect(() => {
    if (enableAnimations) {
      Animated.spring(progressAnim, {
        toValue: strength.progress,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      progressAnim.setValue(strength.progress);
    }
  }, [strength.progress, enableAnimations, progressAnim]);

  // Handle delayed auto-hide when password becomes valid
  useLayoutEffect(() => {
    if (dropdownMode !== true || autoHideWhenValid !== true) return;

    if (autoHideTimerRef.current !== null) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }

    if (autoHideKey !== null) {
      autoHideTimerRef.current = setTimeout(() => {
        setElapsedAutoHideKey(autoHideKey);
        autoHideTimerRef.current = null;
      }, autoHideDelay);
    }

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (autoHideTimerRef.current !== null) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [autoHideDelay, autoHideKey, autoHideWhenValid, dropdownMode]);

  // Animate dropdown visibility
  useEffect(() => {
    if (dropdownMode !== true) return;

    // Determine if dropdown should be visible
    // Show if: password has content AND (autoHide is disabled OR password is not valid OR we're in pending hide state)
    const shouldShowDropdown =
      password.length > 0 && (autoHideWhenValid !== true || !isValid || isPendingAutoHide);

    if (enableAnimations === true) {
      Animated.parallel([
        Animated.timing(dropdownOpacity, {
          toValue: shouldShowDropdown ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(dropdownTranslateY, {
          toValue: shouldShowDropdown ? 0 : -10,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
      ]).start();
    } else {
      dropdownOpacity.setValue(shouldShowDropdown ? 1 : 0);
      dropdownTranslateY.setValue(shouldShowDropdown ? 0 : -10);
    }
  }, [
    password.length,
    isValid,
    autoHideWhenValid,
    isPendingAutoHide,
    dropdownMode,
    enableAnimations,
    dropdownOpacity,
    dropdownTranslateY,
  ]);

  /**
   * Render progress bar with strength indicator
   */
  const renderProgressBar = () => {
    if (!showProgressBar) return null;

    // In dropdown mode, show compact mini progress bar
    if (dropdownMode === true) {
      return (
        <View style={[styles.dropdownProgressBarContainer, progressBarStyle]}>
          <Progress.Bar
            progress={strength.progress}
            width={null} // Full width
            height={3}
            color={strength.color}
            unfilledColor={theme.colors.surfaceVariant}
            borderWidth={0}
            borderRadius={2}
            animated={enableAnimations}
            animationType='spring'
          />
        </View>
      );
    }

    return (
      <View style={[styles.progressBarContainer, progressBarStyle]}>
        <View style={styles.progressBarLabel}>
          <Text style={styles.strengthLabel}>Password Strength</Text>
          <Text style={[styles.strengthScore, { color: strength.color }]}>{strength.label}</Text>
        </View>

        <Progress.Bar
          progress={strength.progress}
          width={null} // Full width
          height={8}
          color={strength.color}
          unfilledColor={theme.colors.surfaceVariant}
          borderWidth={0}
          borderRadius={4}
          animated={enableAnimations}
          animationType='spring'
        />
      </View>
    );
  };

  /**
   * Render individual rule item with icon and label
   */
  const renderRuleItem = (rule: (typeof rules)[0]) => {
    const iconColor = rule.isMet ? theme.colors.primary : theme.colors.neutral[500];
    const iconName = rule.isMet ? 'checkmark-circle' : 'ellipse-outline';
    const iconSize = dropdownMode === true ? 14 : 20;

    // Extract styles to variables for type safety
    const containerStyle = (
      dropdownMode === true ? styles.dropdownRuleItem : styles.ruleItem
    ) as ViewStyle;
    const stateStyle = (rule.isMet ? styles.ruleItemMet : styles.ruleItemUnmet) as ViewStyle;
    const iconContainerStyle = (
      dropdownMode === true ? styles.dropdownRuleIconContainer : styles.ruleIconContainer
    ) as ViewStyle;
    const textBaseStyle = (
      dropdownMode === true ? styles.dropdownRuleText : styles.ruleText
    ) as TextStyle;
    const textStateStyle = (rule.isMet ? styles.ruleTextMet : styles.ruleTextUnmet) as TextStyle;
    return (
      <View
        key={rule.id}
        style={[containerStyle, stateStyle, ruleItemStyle]}
        testID={`${testID}-rule-${rule.id}`}
      >
        <View style={iconContainerStyle}>
          <Icon name={iconName} size={iconSize} color={iconColor} />
        </View>

        <Text style={[textBaseStyle, textStateStyle, ruleTextStyle]}>{rule.label}</Text>
      </View>
    );
  };

  /**
   * Render password rules list
   */
  const renderRules = () => {
    if (!showRules) return null;

    const basicRules = rules.slice(0, 5); // minLength, upper, lower, number, special
    const personalInfoRule = rules.find(rule => rule.id === 'noPersonalInfo'); // Get personal info rule

    if (dropdownMode === true) {
      // Compact dropdown layout - show basic rules + personal info rule
      return (
        <View style={styles.dropdownRulesContainer as ViewStyle}>
          {basicRules.map(renderRuleItem)}
          {personalInfoRule && renderRuleItem(personalInfoRule)}
        </View>
      );
    }

    return (
      <View style={styles.rulesContainer}>
        <Text style={styles.rulesSectionTitle}>Password Requirements</Text>

        {/* Basic Rules Only */}
        <View style={styles.basicRulesContainer}>{basicRules.map(renderRuleItem)}</View>
      </View>
    );
  };

  /**
   * Render success cue banner (shown when all requirements are met)
   */
  const renderSuccessCue = () => {
    if (!showSuccessCue || !dropdownMode || !isValid) return null;

    return (
      <View style={styles.successCue as ViewStyle}>
        <Icon name='checkmark-circle' size={16} color={theme.colors.primary} />
        <Text style={styles.successCueText as TextStyle}>All requirements met!</Text>
      </View>
    );
  };

  /**
   * Render feedback messages
   */
  const renderFeedback = () => {
    if (!showFeedback || feedback.length === 0) return null;

    // Determine feedback style based on content
    const getFeedbackStyle = () => {
      if (isValid) return styles.feedbackTextSuccess;
      if (feedback.some(msg => msg.toLowerCase().includes('weak'))) {
        return styles.feedbackTextError;
      }
      return undefined;
    };

    return (
      <View style={styles.feedbackContainer}>
        {feedback.map((message, index) => (
          <Text
            key={`feedback-${message.substring(0, 20)}-${index}`}
            style={[styles.feedbackText, getFeedbackStyle(), feedbackTextStyle]}
          >
            {index === 0 ? message : `• ${message}`}
          </Text>
        ))}
      </View>
    );
  };

  /**
   * Render warning banner when password doesn't meet minimum strength threshold
   */
  const renderWarningBanner = () => {
    // Only show if password has content but score is below minimum threshold (2)
    if (password?.length === 0 || strength.score >= 2) return null;

    // Get all basic rules met
    const basicRules = rules.slice(0, 5);
    const allBasicMet = basicRules.every(rule => rule.isMet);

    // Only show if basic rules are met but strength is still weak
    if (!allBasicMet) return null;

    return (
      <View style={styles.warningBanner}>
        <Icon name='warning' size={20} color='#FF9800' />
        <Text style={styles.warningBannerText}>
          Password is too weak. Backend requires at least &ldquo;Fair&rdquo; strength.
        </Text>
      </View>
    );
  };

  // Hide component if in dropdown mode and conditions met
  const shouldHideDropdown =
    dropdownMode === true &&
    (password.length === 0 || (autoHideWhenValid === true && isValid && !isPendingAutoHide));

  if (shouldHideDropdown) {
    return null;
  }

  // Dropdown mode: animated floating card
  if (dropdownMode === true) {
    const dropdownCardStyle = styles.dropdownCard as ViewStyle;
    const dropdownContainerStyle = styles.dropdownContainer as ViewStyle;

    return (
      <Animated.View
        style={[
          dropdownContainerStyle,
          {
            opacity: dropdownOpacity,
            transform: [{ translateY: dropdownTranslateY }],
          },
          containerStyle,
        ]}
        testID={testID}
      >
        <View style={dropdownCardStyle}>
          {renderSuccessCue()}
          {renderRules()}
          {showProgressBar && renderProgressBar()}
        </View>
      </Animated.View>
    );
  }

  // Standard mode: full layout
  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {showStrength && renderProgressBar()}
      {renderRules()}
      {renderFeedback()}
      {renderWarningBanner()}
    </View>
  );
};
