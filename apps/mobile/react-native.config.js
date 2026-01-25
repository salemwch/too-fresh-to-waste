// React Native Configuration for Monorepo
// Based on: https://github.com/react-native-community/cli/blob/main/docs/autolinking.md
// Purpose: Provides autolinking configuration and package metadata

module.exports = {
  project: {
    android: {
      // Package name for autolinking (must match android/app/build.gradle applicationId)
      packageName: 'com.foodwasteapp',
    },
    // iOS configuration removed - bundleIdentifier not supported in RN 0.81 config schema
    // iOS setup requires macOS and will be configured separately
  },
  // Dependencies configuration for Nitro-based libraries
  // Nitro modules use their own Nitrogen tooling instead of RN's codegen
  // We disable CMake/codegen autolinking while keeping basic autolinking enabled
  // Source: https://github.com/react-native-community/cli/blob/main/docs/autolinking.md
  dependencies: {
    'react-native-nitro-modules': {
      platforms: {
        android: null, // disable Android autolinking for this package
      },
    },
    'react-native-mmkv': {
      platforms: {
        android: null,
      },
    },
  },
};
