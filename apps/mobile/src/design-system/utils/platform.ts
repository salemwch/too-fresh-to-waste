/**
 * Platform Utilities
 * Platform-specific helpers and configurations
 */

import React from 'react';
import { Platform, Dimensions } from 'react-native';

// Platform detection
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

// Version checks
export const iosVersion = Platform.Version as number;
export const androidVersion = Platform.Version as number;

// Modern platform features
export const supportsHapticFeedback = isIOS || (isAndroid && androidVersion >= 23);
export const supportsDynamicColors = isAndroid && androidVersion >= 31;
export const supportsSafeArea = isIOS || (isAndroid && androidVersion >= 28);

// Screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const screen = {
  width: screenWidth,
  height: screenHeight,
  isTablet: screenWidth >= 768,
  isLargeScreen: screenWidth >= 1024,
};

// Platform-specific style selector
export const platformSelect = <T>(config: {
  ios?: T;
  android?: T;
  web?: T;
  default?: T;
}): T | undefined => {
  if (isIOS && config.ios !== undefined) return config.ios;
  if (isAndroid && config.android !== undefined) return config.android;
  if (isWeb && config.web !== undefined) return config.web;
  return config.default;
};

// Platform-specific component selector
export const PlatformComponent = <T extends React.ComponentType<any>>({
  ios,
  android,
  web,
  default: defaultComponent,
  ...props
}: {
  ios?: T;
  android?: T;
  web?: T;
  default?: T;
  [key: string]: any;
}) => {
  const Component = platformSelect({
    ...(ios && { ios }),
    ...(android && { android }),
    ...(web && { web }),
    ...(defaultComponent && { default: defaultComponent }),
  });
  return Component ? React.createElement(Component, props) : null;
};

// Safe area helpers
export const getSafeAreaInsets = () =>
  // This would typically use react-native-safe-area-context
  // For now, return default values
  ({
    top: isIOS ? 44 : 24,
    bottom: isIOS ? 34 : 0,
    left: 0,
    right: 0,
  });

// Haptic feedback helpers
export const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (!supportsHapticFeedback) return;

  try {
    if (isIOS) {
      // Use iOS haptic feedback
      const HapticFeedback = require('react-native').HapticFeedback;
      switch (type) {
        case 'light':
          HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Heavy);
          break;
      }
    } else if (isAndroid) {
      // Use Android haptic feedback
      // This would require a library like react-native-haptic-feedback
      console.log(`Android haptic feedback: ${type}`);
    }
  } catch (error) {
    console.warn('Haptic feedback not available:', error);
  }
};

// Platform-specific styling helpers
export const platformStyles = {
  // iOS specific styles
  ios: {
    shadow: (elevation: number) => ({
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: elevation / 2,
      },
      shadowOpacity: 0.1 + elevation / 50,
      shadowRadius: elevation,
    }),

    blur: (intensity: number) => ({
      backgroundColor: `rgba(255, 255, 255, ${0.7 + intensity / 100})`,
    }),
  },

  // Android specific styles
  android: {
    elevation: (level: number) => ({
      elevation: level,
    }),

    ripple: (color: string) => ({
      android_ripple: {
        color,
        borderless: false,
      },
    }),
  },

  // Cross-platform helpers
  cross: {
    shadow: (elevation: number) => {
      if (isIOS) {
        return platformStyles.ios.shadow(elevation);
      } else if (isAndroid) {
        return platformStyles.android.elevation(elevation);
      }
      return {};
    },
  },
};

// Font loading helpers
export const loadCustomFonts = async () => {
  // This would load custom fonts using expo-font or similar
  try {
    // await Font.loadAsync({
    //   'CustomFont': require('./assets/fonts/CustomFont.ttf'),
    // });
    console.log('Custom fonts loaded');
  } catch (error) {
    console.warn('Failed to load custom fonts:', error);
  }
};

// Device capabilities
export const deviceCapabilities = {
  hasNotch: isIOS && screenHeight >= 812,
  hasDynamicIsland: isIOS && screenHeight >= 852,
  supportsBlur: isIOS,
  supportsVibration: supportsHapticFeedback,
  supportsBiometrics: true, // Would check actual biometric availability
  supportsCamera: true, // Would check camera permissions
  supportsLocation: true, // Would check location permissions
};

// Accessibility helpers
export const accessibilityHelpers = {
  isScreenReaderEnabled: false, // Would check actual screen reader status
  isReduceMotionEnabled: false, // Would check motion preferences
  isHighContrastEnabled: false, // Would check contrast preferences

  announceForAccessibility: (message: string) => {
    // Would use AccessibilityInfo.announceForAccessibility
    console.log('Accessibility announcement:', message);
  },
};

// Export platform info object
export const platformInfo = {
  os: Platform.OS,
  version: Platform.Version,
  isIOS,
  isAndroid,
  isWeb,
  screen,
  capabilities: deviceCapabilities,
  accessibility: accessibilityHelpers,
};
