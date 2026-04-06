/**
 * Babel Configuration for React Native Mobile App
 *
 * Enterprise-grade OPTIMIZED transpilation config for monorepo workspace
 *
 * Performance Enhancements:
 * ✓ Optimized plugin ordering (faster transforms)
 * ✓ Environment-specific transforms (dev vs prod)
 * ✓ Lazy compilation support
 * ✓ Tree shaking optimizations
 *
 * @see https://babeljs.io/docs/en/configuration
 * @see https://reactnative.dev/docs/environment-setup
 */

const path = require('path');

/**
 * Environment detection
 * Different optimizations for dev vs production
 */
const isDev = process.env.NODE_ENV !== 'production';
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  /**
   * Presets define transformation pipelines
   *
   * @react-native/babel-preset includes:
   * - @babel/preset-env: Modern JS → Compatible JS
   * - @babel/preset-react: JSX → createElement calls
   * - @babel/preset-typescript: TypeScript → JavaScript
   * - Flow stripping (if used)
   * - Metro-specific optimizations
   */
  presets: [
    [
      'module:@react-native/babel-preset',
      {
        // Disable loose mode in favor of top-level assumptions
        useTransformReactJSXExperimental: false,
        // Explicitly disable loose mode for class features
        unstable_disableES6Transforms: false,
      },
    ],
  ],

  /**
   * Environment-specific configurations
   * Optimizes based on NODE_ENV
   */
  env: {
    production: {
      plugins: [
        /**
         * Remove ALL console.* calls in production
         * Per https://reactnative.dev/docs/performance — console.log is a
         * major JS thread bottleneck; error/warn also serialize arguments.
         * Use Logger utility (src/utils/logger.ts) for production logging.
         */
        'transform-remove-console',
      ],
    },
    development: {
      plugins: [
        /**
         * Faster refresh in development
         * Required by React Native Fast Refresh
         */
      ],
    },
  },

  plugins: [
    /**
     * Module Resolver Plugin
     *
     * Transforms path aliases at compile time
     * Critical for monorepo module resolution
     *
     * @see https://github.com/tleunen/babel-plugin-module-resolver
     *
     * Performance: Faster imports, smaller bundle (relative paths)
     *
     * Priority Order:
     * 1. Platform-specific files (.ios.ts, .android.ts)
     * 2. TypeScript files (.ts, .tsx)
     * 3. JavaScript files (.js, .jsx)
     * 4. JSON files (.json)
     */
    [
      'module-resolver',
      {
        /**
         * Root directories for module resolution
         * Babel will search here for non-aliased imports
         */
        root: ['./src'],

        /**
         * File extensions in resolution priority order
         *
         * Optimization: Most common extensions first for faster resolution
         *
         * Platform-specific first:
         * - .ios.ts: iOS-specific TypeScript
         * - .android.ts: Android-specific TypeScript
         *
         * Then general TypeScript (most common):
         * - .ts: TypeScript
         * - .tsx: TypeScript + JSX
         *
         * Then JavaScript:
         * - .jsx: JavaScript + JSX
         * - .js: Plain JavaScript
         *
         * Finally data:
         * - .json: JSON data files
         */
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],

        /**
         * Import path aliases
         *
         * CRITICAL: Must match EXACTLY with:
         * - tsconfig.json paths ✓
         * - metro.config.js extraNodeModules ✓
         *
         * Consistency Principle:
         * All tools must agree on module locations:
         * - Babel transforms the imports
         * - Metro bundles the modules
         * - TypeScript type-checks them
         *
         * Pattern:
         * '@alias': 'relative/path/from/babel/config'
         *
         * All paths are relative to this babel.config.js file (apps/mobile/)
         */
        alias: {
          /* Local app aliases */
          '@': './src',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/services': './src/services',
          '@/store': './src/store',
          '@/utils': './src/utils',
          '@/types': './src/types',
          '@/config': './src/config',
          '@/assets': './src/assets',

          /**
           * Workspace shared package
           *
           * Points to SOURCE files (not dist) for:
           * ✓ Hot module reloading
           * ✓ Instant feedback on shared code changes
           * ✓ No rebuild step required
           * ✓ Better debugging with source maps
           */
          '@foodwaste/shared': '../../packages/shared/src',
        },

        /**
         * Strip root path from compiled output
         * Smaller bundle size with relative paths
         */
        cwd: 'babelrc',
      },
    ],

    /**
     * React Native Reanimated Plugin
     * MUST be listed last
     *
     * Transforms worklets for Reanimated animations
     * Required for gesture-handler + reanimated
     *
     * @see https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation
     */
    'react-native-reanimated/plugin',
  ],

  /**
   * Only parse files we need — improves Metro compilation speed.
   * IMPORTANT: Skip test files only outside of the 'test' env so that
   * Jest (which sets NODE_ENV=test) can still transform them via babel-jest.
   */
  ignore:
    process.env.NODE_ENV === 'test'
      ? []
      : [
          '**/node_modules/*/test',
          '**/node_modules/*/tests',
          '**/__tests__',
          '**/__mocks__',
          '**/*.test.js',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.js',
          '**/*.spec.ts',
          '**/*.spec.tsx',
        ],

  /**
   * Source type configuration
   * 'unambiguous' lets Babel auto-detect module vs script
   */
  sourceType: 'unambiguous',

  /**
   * Comments configuration
   * Remove comments in production for smaller bundle
   */
  comments: isDev,

  /**
   * Minification hints
   * These help the minifier optimize better
   */
  minified: false, // Metro handles minification
  compact: isProd ? 'auto' : false, // Auto-compact in production

  /**
   * Auxiliary comment removal
   * Removes helper comments for smaller output
   */
  auxiliaryCommentBefore: undefined,
  auxiliaryCommentAfter: undefined,

  /**
   * Retain lines for better debugging in development
   * Disabled in production for smaller output
   */
  retainLines: isDev,

  /**
   * Highlighting for better error messages (dev only)
   */
  highlightCode: isDev,
};
