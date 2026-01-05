// React Native Configuration for Monorepo
// Based on: https://reactnative.dev/docs/native-modules-android
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
  // Dependencies configuration
  // Leave empty to use default autolinking for all packages
  dependencies: {
    // Explicitly exclude packages if needed
    // Example: 'some-package': { platforms: { android: null } }
  },
};
