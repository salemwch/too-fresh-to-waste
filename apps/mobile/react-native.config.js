// React Native Configuration for Monorepo
// Based on: https://github.com/react-native-community/cli/blob/main/docs/autolinking.md
// Purpose: Provides autolinking configuration and package metadata

const fs = require('fs');
const path = require('path');

// ============================================================================
// Auto-discover @react-native-vector-icons scoped packages to exclude from
// Android native autolinking. Each icon set package (v12.x) has a no-op
// TurboReactPackage and no codegenConfig in package.json, which causes
// CMake errors with newArchEnabled=true. Fonts load dynamically via Metro's
// require() + loadFontAsync — no native linking needed.
// Source: https://github.com/oblador/react-native-vector-icons/issues/1728
// ============================================================================
const vectorIconsExclusions = {};
const vectorIconsDir = path.resolve(__dirname, '../../node_modules/@react-native-vector-icons');
if (fs.existsSync(vectorIconsDir)) {
  fs.readdirSync(vectorIconsDir)
    .filter(name => name !== 'common' && !name.startsWith('.') && name !== 'node_modules')
    .forEach(name => {
      vectorIconsExclusions[`@react-native-vector-icons/${name}`] = {
        platforms: { android: null },
      };
    });
}

module.exports = {
  project: {
    android: {
      // Package name for autolinking (must match android/app/build.gradle applicationId)
      packageName: 'com.foodwasteapp',
    },
    // iOS configuration removed — bundleIdentifier not supported in RN 0.81 config schema
    // iOS setup requires macOS and will be configured separately
  },
  dependencies: {
    // Nitro modules use their own Nitrogen tooling instead of RN's codegen
    // Disable CMake/codegen autolinking while keeping basic autolinking enabled
    'react-native-nitro-modules': {
      platforms: { android: null },
    },
    'react-native-mmkv': {
      platforms: { android: null },
    },
    // Dynamically excluded — see vectorIconsExclusions above
    ...vectorIconsExclusions,
  },
};
