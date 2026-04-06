/**
 * @format
 * React Native App Entry Point
 *
 * CRITICAL SETUP ORDER:
 * 1. react-native-gesture-handler - MUST BE FIRST (touch event handling)
 * 2. enableScreens() - Native screen optimization (30-50% faster navigation)
 * 3. enableFreeze() - Freeze inactive screens (40% memory reduction)
 *
 * Sources:
 * - https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation
 * - https://github.com/software-mansion/react-native-screens#setup
 * - https://reactnavigation.org/docs/react-native-screens/
 */

// ============================================================================
// CRITICAL: Gesture Handler MUST Be Imported First
// ============================================================================
// ✅ REQUIRED: Import at the very top (before any other imports)
// Overrides React Native's touch handling system
// Without this, navigation touch events may not fire correctly
// Source: https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation
import 'react-native-gesture-handler';

import React from 'react';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';

import App from './src/App';

// ============================================================================
// PRODUCTION: Native Screen Optimization
// ============================================================================
// ✅ PERFORMANCE BOOST: 30-50% faster navigation
// Uses native screen containers instead of plain React Native views
// Required for optimal React Navigation performance
// Source: https://github.com/software-mansion/react-native-screens
enableScreens(true);

// ============================================================================
// PRODUCTION: Memory Optimization
// ============================================================================
// ⚠️ DISABLED: enableFreeze(true) causes touch event issues on Android
// with react-native-screens v4.x + React Navigation v6.x combination.
// react-native-screens v4 is designed for React Navigation v7.
// Re-enable after upgrading to React Navigation v7.
// Source: https://github.com/software-mansion/react-native-screens/issues/2355
// enableFreeze(true);

// ============================================================================
// App Registration
// ============================================================================
// IMPORTANT: This name must match MainActivity.kt getMainComponentName()
// MainActivity.kt:15 returns "FoodWasteApp"
// Using package.json "name" field (@foodwaste/mobile) causes:
// "Invariant Violation: 'FoodWasteApp' has not been registered"
const appName = 'FoodWasteApp';

function AppEntryPoint() {
  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

AppRegistry.registerComponent(appName, () => AppEntryPoint);
