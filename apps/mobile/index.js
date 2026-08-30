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
// Development-only session seeding
// ============================================================================
// Reaches the authenticated screens on an emulator without touching auth. See
// src/dev/devSession.ts for the three gates - this cannot run in a release
// build, and it refuses to write anything unless the app is pointed at a mock
// on localhost.
//
// `__DEV__` is a compile-time constant, so the whole block is dead code in a
// release bundle and the module is never evaluated.
//
// The reload is not decoration. Seeding writes to the Keychain asynchronously
// while RootNavigator is already dispatching loadStoredAuthAsync, so the first
// launch would otherwise race and lose. Seeding returns true only on the launch
// that actually wrote something; reloading then lets the app's own restore path
// find the session on a clean pass.
if (__DEV__) {
  // `require`, not `import`, on purpose: a static import would put this module
  // in the top-level graph of every build including release. Keeping it behind
  // the guard is the isolation, so the rule is disabled here rather than the
  // code changed to satisfy it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedDevSessionIfEnabled } = require('./src/dev/devSession');
  void seedDevSessionIfEnabled().then(({ seeded }) => {
    if (seeded) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native').DevSettings.reload();
    }
  });

  // Seeds a manual location so LocationSelectionModal does not gate the
  // authenticated screens on an emulator with no GPS fix. Dispatches the
  // slice's own setManualLocation once the store has rehydrated - it does not
  // touch permission state, and it leaves an existing location alone.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedDevLocationIfEnabled } = require('./src/dev/devLocation');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  seedDevLocationIfEnabled(require('./src/store').store);

  // The driver screens do not read the persisted location: they call
  // Geolocation.watchPosition and gate on its result, so on an emulator with no
  // GPS they never leave "Acquiring GPS signal". This returns one fixed fix so
  // that flow is reachable. Permission handling is deliberately not patched.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedDevGeolocationIfEnabled } = require('./src/dev/devGeolocation');
  seedDevGeolocationIfEnabled();
}

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
