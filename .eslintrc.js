/**
 * Root monorepo ESLint config.
 * Applies to apps/mobile and packages/shared/ui.
 * apps/food-waste-backend has its own eslint.config.js (flat config).
 * apps/web inherits from here but can add next lint on top.
 */
module.exports = {
  root: true,
  extends: ['@foodwaste/eslint-config/react-native'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaFeatures: { jsx: true },
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: [
          './apps/mobile/tsconfig.json',
          './apps/web/tsconfig.json',
          './packages/shared/tsconfig.json',
          './packages/ui/tsconfig.json',
        ],
      },
    },
  },
  overrides: [
    // packages/shared — relax strict-boolean-expressions (cross-platform patterns)
    {
      files: ['packages/shared/**/*'],
      rules: {
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'android/',
    'ios/',
    'apps/food-waste-backend/', // has its own eslint.config.js
    '**/*.d.ts',               // generated declaration files
    'packages/shared/src/**/*.js', // compiled JS artifacts in src (belong in dist)
  ],
};
