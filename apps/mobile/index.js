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
import { enableFreeze, enableScreens } from 'react-native-screens';

import App from './src/App';

enableScreens(true);
enableFreeze(true);

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
