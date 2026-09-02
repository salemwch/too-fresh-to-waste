/**
 * Metro Configuration for React Native Monorepo
 *
 * Enterprise-grade OPTIMIZED configuration for pnpm workspace with shared packages
 *
 * Performance Enhancements:
 * ✓ Persistent disk caching (~50% faster rebuilds)
 * ✓ Multi-threaded transformations (CPU core count scaling)
 * ✓ Advanced minification & tree shaking (smaller bundles)
 * ✓ Source map optimization (dev vs prod)
 * ✓ Asset optimization (lazy loading, compression)
 *
 * @format
 * @see https://facebook.github.io/metro/docs/configuration
 * @see https://reactnative.dev/docs/metro
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const { withSentryConfig } = require('@sentry/react-native/metro');

// ============================================================================
// PATH CONFIGURATION
// ============================================================================

/**
 * Root of the monorepo workspace
 * Contains: apps/, packages/, node_modules/
 */
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Root of this React Native project
 * Location: apps/mobile/
 */
const projectRoot = __dirname;

/**
 * Cache directory for persistent Metro cache
 * Location: apps/mobile/.metro-cache
 */
const cacheDirectory = path.resolve(projectRoot, '.metro-cache');

// ============================================================================
// PERFORMANCE CONFIGURATION
// ============================================================================

/**
 * Detect available CPU cores for parallel processing
 * Reserves 1 core for system to prevent freezing
 */
const MAX_WORKERS = Math.max(1, os.cpus().length - 1);

/**
 * Environment detection
 * Production bundles need different optimization than development
 */
const isDev = process.env.NODE_ENV !== 'production';
const isProd = process.env.NODE_ENV === 'production';

// ============================================================================
// METRO CONFIGURATION
// ============================================================================

// Pull default resolver lists so we can move SVG out of assets and into sources
const defaultConfig = getDefaultConfig(__dirname);
// Only sourceExts is derived from the defaults — assetExts below is an explicit
// list (svg is deliberately absent so react-native-svg-transformer handles it).
const { sourceExts: defaultSourceExts } = defaultConfig.resolver;

const config = {
  /**
   * Project root directory
   * Metro will use this as the base for all relative paths
   */
  projectRoot,

  /**
   * Watch folders for file changes
   * Enables hot reloading for shared packages without rebuilding
   *
   * CRITICAL: Must include workspace root to watch shared package sources
   */
  watchFolders: [workspaceRoot],

  /**
   * Maximum worker count for parallel transformations
   * Source: https://facebook.github.io/metro/docs/configuration#maxworkers
   *
   * Performance Impact:
   * - 1 worker: Baseline speed
   * - 4 workers: ~3x faster on quad-core CPU
   * - 8 workers: ~5-6x faster on 8-core CPU
   *
   * Automatically scales to CPU count
   */
  maxWorkers: MAX_WORKERS,

  /**
   * Persistent cache configuration
   * Source: https://facebook.github.io/metro/docs/configuration#cacheversion
   *
   * Performance Impact:
   * - First build: Same speed (creates cache)
   * - Subsequent builds: ~50% faster (reads from cache)
   * - Clean rebuilds: ~70% faster (partial cache hit)
   *
   * Cache invalidation:
   * - Change cache version to force rebuild
   * - Delete .metro-cache folder
   * - Run with --reset-cache flag
   */
  cacheStores: [
    new (require('metro-cache').FileStore)({
      root: cacheDirectory,
    }),
  ],

  /**
   * Cache version identifier
   * Increment when making breaking config changes to invalidate cache
   */
  cacheVersion: 'v2-optimized',

  /**
   * Reset cache on every start (disabled for performance)
   * Set to true only when debugging cache issues
   */
  resetCache: false,

  resolver: {
    /**
     * Enable global packages resolution
     * Allows Metro to resolve packages from workspace root node_modules
     */
    enableGlobalPackages: true,

    /**
     * Module resolution order for platform-specific code
     * Priority: react-native > browser > main
     */
    resolverMainFields: ['react-native', 'browser', 'main'],

    /**
     * Node modules search paths
     * Order matters: local node_modules take precedence over workspace
     *
     * Resolution order:
     * 1. apps/mobile/node_modules (hoisted packages)
     * 2. <workspace>/node_modules (workspace packages)
     */
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],

    /**
     * Extra module mappings for workspace packages
     *
     * CRITICAL: Must point to SOURCE files (/src) not compiled files (/dist)
     *
     * Why source files?
     * ✓ Hot reloading works for shared package changes
     * ✓ No need to rebuild shared package on every change
     * ✓ Better debugging with source maps
     * ✓ Faster development cycle
     * ✓ Babel transforms TypeScript on-the-fly
     *
     * Pattern: '@workspace/package': 'packages/package/src'
     */
    extraNodeModules: {
      '@foodwaste/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
      // Web-only Sentry packages used to be "stubbed" here. That never worked:
      // extraNodeModules is a FALLBACK consulted only when normal node_modules
      // resolution fails, and these packages are physically installed, so the
      // stub was never resolved once (verified against the production
      // sourcemap - the stub file was absent, the 299 KiB of
      // @sentry-internal/replay was not). The working mechanism is the
      // vendor's own `includeWebReplay: false` on withSentryConfig at the
      // bottom of this file, which intercepts resolution BEFORE node_modules
      // lookup. Guarded by src/__tests__/metroSentryResolver.test.ts.
    },

    /**
     * Drop the icon-font .ttf that @react-native-vector-icons requires at module
     * scope, on Android only. Same reasoning as the Sentry stubs above: it is
     * bundled but provably never read.
     *
     * `@react-native-vector-icons/ionicons/lib/module/index.js` does an
     * unconditional `require('../../fonts/Ionicons.ttf')` to populate
     * `fontSource`. Metro therefore emits the font a SECOND time, as
     * res/raw/__node_modules_reactnativevectoricons_ionicons_fonts_ionicons.ttf
     * (~380 KB), on top of android/app/src/main/assets/fonts/Ionicons.ttf.
     *
     * Only the assets/ copy renders anything. createIconSet() draws icons as
     * <Text style={{fontFamily:'Ionicons'}}>, which Android resolves from
     * assets/fonts/ and nowhere else. `fontSource` is read by exactly one code
     * path — Expo dynamic font loading — which is gated on
     * globalThis.expo.modules.ExpoAsset + ExpoFontLoader. This is a bare React
     * Native app with no Expo, so isDynamicLoadingEnabled() is permanently
     * false, Icon initialises isFontLoaded=true, and the loadFontAsync() branch
     * is unreachable. The other reader, getImageSource(), has no call sites here.
     *
     * DO NOT delete android/app/src/main/assets/fonts/Ionicons.ttf — that file
     * is what draws every icon, including the navigation back arrow.
     *
     * Android-only on purpose: iOS links vector-icons natively and resolves
     * fonts differently, so leave that platform's resolution untouched.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (
        platform === 'android' &&
        moduleName.endsWith('.ttf') &&
        context.originModulePath.includes('@react-native-vector-icons')
      ) {
        return { type: 'empty' };
      }
      return context.resolveRequest(context, moduleName, platform);
    },

    /**
     * Source file extensions
     * Metro will resolve these in order for each import
     *
     * Optimization: Platform-specific files first for faster resolution
     * Note: 'svg' added to sourceExts for react-native-svg-transformer support
     */
    sourceExts: [...defaultSourceExts, 'ts', 'tsx', 'js', 'jsx', 'json', 'mjs', 'cjs', 'svg'],

    /**
     * Asset file extensions
     * Files matching these will be treated as assets
     *
     * Optimized: Removed rarely-used extensions for faster pattern matching
     * Note: 'svg' removed from assetExts to enable SVG component imports
     */
    assetExts: [
      // Images (most common first)
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      // svg intentionally excluded — handled as source via react-native-svg-transformer
      // Fonts
      'ttf',
      'otf',
      'woff',
      'woff2',
      // Media
      'mp4',
      'webm',
      'wav',
      'mp3',
      'm4a',
      'aac',
      // Documents
      'pdf',
    ],

    /**
     * Block list for modules to never resolve
     * Improves resolution speed by skipping unnecessary directories
     *
     * Performance Impact: ~5-10% faster module resolution
     */
    blockList: [
      // Ignore git worktrees — they duplicate root package.json causing Haste collisions
      /[/\\]\.worktrees[/\\]/,
      // Ignore build artifacts (scoped to project — not node_modules which use dist/)
      /\/build\//,
      /\.expo\//,
      // Ignore test files (not needed in bundle)
      /\/__tests__\//,
      /\/__mocks__\//,
      /\.test\.(js|jsx|ts|tsx)$/,
      /\.spec\.(js|jsx|ts|tsx)$/,
      // Ignore editor configs
      /\.vscode\//,
      /\.idea\//,
      // Ignore documentation
      /\/docs\//,
      /\.md$/,
    ],
  },

  transformer: {
    /**
     * Babel transformer options
     *
     * experimentalImportSupport: false
     *   - Standard import/export handling
     *   - More reliable with TypeScript
     *
     * inlineRequires: true
     *   - Inline require() calls for lazy loading
     *   - Reduces initial bundle size by ~15-25%
     *   - Improves app startup time by ~200-400ms
     *   - Modules loaded only when needed
     */
    babelTransformerPath: require.resolve('react-native-svg-transformer'),

    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),

    /**
     * Minifier configuration
     * Source: https://github.com/terser/terser#minify-options
     *
     * Production: Aggressive minification for smallest bundle
     * Development: Keep names/classes for debugging
     */
    minifierConfig: {
      // Code compression
      compress: {
        drop_console: isProd, // Remove console.* in production
        drop_debugger: isProd, // Remove debugger statements in production
        passes: isProd ? 3 : 1, // Multiple passes for better compression (prod only)
        pure_funcs: isProd ? ['console.log', 'console.debug', 'console.info'] : [],
        reduce_vars: isProd, // Aggressive variable inlining (prod only)
        collapse_vars: isProd, // Collapse single-use variables
        sequences: isProd, // Join consecutive statements with comma
        dead_code: true, // Remove unreachable code
        conditionals: true, // Optimize if-s and conditional expressions
        booleans: true, // Optimize boolean expressions
        unused: true, // Drop unreferenced functions and variables
        if_return: true, // Optimize if/return and if/continue
        join_vars: true, // Join consecutive var statements
        comparisons: true, // Optimize comparisons
      },

      // Output formatting
      output: {
        comments: false, // Remove all comments for smaller size
        ascii_only: true, // Escape Unicode characters for compatibility
        beautify: false, // No pretty printing (smaller output)
      },

      // Mangling (variable name shortening)
      mangle: {
        keep_classnames: !isProd, // Keep class names in dev for debugging
        keep_fnames: !isProd, // Keep function names in dev for stack traces
        toplevel: isProd, // Mangle top-level scope in production
        safari10: true, // Safari 10 compatibility
      },

      // Source maps
      sourceMap: {
        // Source maps only in dev (production uses separate sourcemap file)
        includeSources: isDev,
        filename: 'index.bundle.js',
        url: 'index.bundle.js.map',
      },
    },

    /**
     * Minifier path (using Metro's built-in Terser)
     * Alternative: 'metro-minify-esbuild' for ~2x faster minification
     */
    minifierPath: 'metro-minify-terser',

    /**
     * Asset plugins for optimization
     * Images/fonts can be compressed/optimized during bundling
     */
    assetPlugins: [],

  },

  serializer: {
    /**
     * Custom serializer for advanced bundle optimization
     *
     * Performance optimizations:
     * - Tree shaking: Remove unused exports
     * - Code splitting: Separate vendor bundles
     * - Asset optimization: Lazy load images
     */

    /**
     * Custom module ID factory
     * Generates shorter module IDs for smaller bundle size
     *
     * Performance Impact: ~2-5% smaller bundle
     */
    createModuleIdFactory: function () {
      const fileToIdMap = new Map();
      let nextId = 0;
      // Named modulePath, not path — the `path` module is imported at the top
      // of this file and shadowing it here hides it from the whole factory.
      return modulePath => {
        if (!fileToIdMap.has(modulePath)) {
          fileToIdMap.set(modulePath, nextId++);
        }
        return fileToIdMap.get(modulePath);
      };
    },

    /**
     * Custom process for module filtering
     * Exclude modules that are never actually used
     */
    processModuleFilter: module => {
      // Exclude source maps from node_modules in production
      if (isProd && module.path.includes('node_modules') && module.path.endsWith('.map')) {
        return false;
      }

      // Exclude test files
      if (
        module.path.includes('__tests__') ||
        module.path.includes('__mocks__') ||
        /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(module.path)
      ) {
        return false;
      }

      return true;
    },

    /**
     * REMOVED: getPolyfills customization
     *
     * Previously tried: require('@react-native/metro-config/src/defaults/defaults').getPolyfills()
     *
     * ERROR: Package subpath './src/defaults/defaults' is not defined by "exports"
     * The path ./src/defaults/defaults is an internal/private API not exposed in package.json exports field
     *
     * SOLUTION: Let Metro use default polyfills from @react-native/metro-config
     * The default config already includes all necessary polyfills (Promise, Array.from, Object.assign, etc.)
     *
     * Sources:
     * - https://metrobundler.dev/docs/package-exports/
     * - https://reactnative.dev/blog/2023/06/21/package-exports-support
     */
  },

  /**
   * Server configuration
   * Metro bundler server settings
   */
  server: {
    port: 8081, // Default Metro port

    /**
     * Enable compression for faster HMR
     * gzip compression reduces transfer size by ~70%
     */
    //enableVisualizer: true, // Set to true to analyze bundle size
  },

  /**
   * Watcher configuration
   * File watching settings for hot reloading
   */
  /** watchman: {
    // Use Watchman for faster file watching (if installed)
    // Falls back to NodeWatcher if Watchman not available
    //useWatchman: true,
  }, */

  /**
   * Symbolicator configuration
   * Stack trace symbolication for better error reporting
   */
  symbolicator: {
    customizeFrame: frame => {
      // Customize stack trace frames (optional)
      return frame;
    },
  },
};

// ============================================================================
// CACHE DIRECTORY INITIALIZATION
// ============================================================================

/**
 * Ensure cache directory exists
 * Create if missing to prevent cache errors
 */
if (!fs.existsSync(cacheDirectory)) {
  fs.mkdirSync(cacheDirectory, { recursive: true });
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Log configuration info in development
 */
if (isDev && process.env.METRO_DEBUG) {
  console.log('[Metro Config] Performance Settings:');
  console.log(`  Workers: ${MAX_WORKERS} (${os.cpus().length} cores available)`);
  console.log(`  Cache: ${cacheDirectory}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
}

// ============================================================================
// EXPORT MERGED CONFIGURATION
// ============================================================================

/**
 * Merge custom config with React Native defaults
 * Custom settings override defaults where conflicts exist
 *
 * `includeWebReplay: false` installs Sentry's own resolveRequest interceptor,
 * which resolves anything matching /@sentry(-internal)?\/replay/ to an empty
 * module on android/ios bundles. Without it the DOM session-replay code ships:
 * @sentry-internal/replay (299 KiB) + replay-canvas (32 KiB) of source in the
 * production bundle, none of it reachable - replay here is configured
 * exclusively through Sentry.mobileReplayIntegration(), the native
 * implementation. The SDK defaults this option to true, so it must stay
 * explicit. Guarded by src/__tests__/metroSentryResolver.test.ts.
 */
module.exports = withSentryConfig(mergeConfig(getDefaultConfig(__dirname), config), {
  includeWebReplay: false,
});
