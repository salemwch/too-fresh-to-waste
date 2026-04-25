/**
 * NestJS backend ESLint flat config.
 * Extends @foodwaste/eslint-config/flat/nest then adds
 * app-specific module boundary enforcement.
 */
const path = require('path');
const typescriptParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const nestBase = require('@foodwaste/eslint-config/flat/nest');

module.exports = [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'build/**',
      '**/*.js',
      'jest*.config.js',
      'webpack*.config.js',
      '**/*.d.ts',
      '**/migrations/**',
      '**/seeds/**',
    ],
  },

  // Spread shared NestJS rules
  ...nestBase.map(cfg => ({
    ...cfg,
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...cfg.languageOptions?.parserOptions,
        project: [path.resolve(__dirname, './tsconfig.eslint.json')],
        tsconfigRootDir: __dirname,
        createDefaultProgram: false,
        extraFileExtensions: ['.ts'],
        noWarnOnMultipleProjects: true,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: path.resolve(__dirname, './tsconfig.json'),
        },
        node: true,
      },
    },
  })),

  // ── App-specific: module boundary enforcement ─────────────────────────────
  // Common module should not depend on domain modules
  {
    files: ['src/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            // common → no domain deps
            {
              target: './src/common',
              from: './src/auth',
              message: 'Common must not depend on auth.',
            },
            {
              target: './src/common',
              from: './src/users',
              message: 'Common must not depend on users.',
            },
            {
              target: './src/common',
              from: './src/orders',
              message: 'Common must not depend on orders.',
            },
            {
              target: './src/common',
              from: './src/payments',
              message: 'Common must not depend on payments.',
            },
            {
              target: './src/common',
              from: './src/offers',
              message: 'Common must not depend on offers.',
            },
            {
              target: './src/common',
              from: './src/establishments',
              message: 'Common must not depend on establishments.',
            },
            {
              target: './src/common',
              from: './src/favorites',
              message: 'Common must not depend on favorites.',
            },
            {
              target: './src/common',
              from: './src/reviews',
              message: 'Common must not depend on reviews.',
            },
            {
              target: './src/common',
              from: './src/loyalty',
              message: 'Common must not depend on loyalty.',
            },
            {
              target: './src/common',
              from: './src/donations',
              message: 'Common must not depend on donations.',
            },
            {
              target: './src/common',
              from: './src/inventory',
              message: 'Common must not depend on inventory.',
            },
            {
              target: './src/common',
              from: './src/analytics',
              message: 'Common must not depend on analytics.',
            },
            {
              target: './src/common',
              from: './src/notifications',
              message: 'Common must not depend on notifications.',
            },
            {
              target: './src/common',
              from: './src/moderation',
              message: 'Common must not depend on moderation.',
            },
            {
              target: './src/common',
              from: './src/geolocation',
              message: 'Common must not depend on geolocation.',
            },
            {
              target: './src/common',
              from: './src/search',
              message: 'Common must not depend on search.',
            },
            {
              target: './src/common',
              from: './src/health',
              message: 'Common must not depend on health.',
            },
            {
              target: './src/common',
              from: './src/admin',
              message: 'Common must not depend on admin.',
            },
            // auth → no downstream deps
            {
              target: './src/auth',
              from: './src/orders',
              message: 'Auth must not depend on orders.',
            },
            {
              target: './src/auth',
              from: './src/payments',
              message: 'Auth must not depend on payments.',
            },
            {
              target: './src/auth',
              from: './src/offers',
              message: 'Auth must not depend on offers.',
            },
            {
              target: './src/auth',
              from: './src/establishments',
              message: 'Auth must not depend on establishments.',
            },
            {
              target: './src/auth',
              from: './src/favorites',
              message: 'Auth must not depend on favorites.',
            },
            {
              target: './src/auth',
              from: './src/loyalty',
              message: 'Auth must not depend on loyalty.',
            },
            // users → no downstream deps
            {
              target: './src/users',
              from: './src/orders',
              message: 'Users must not depend on orders.',
            },
            {
              target: './src/users',
              from: './src/payments',
              message: 'Users must not depend on payments.',
            },
            {
              target: './src/users',
              from: './src/offers',
              message: 'Users must not depend on offers.',
            },
            // offers → no orders/payments
            {
              target: './src/offers',
              from: './src/orders',
              message: 'Offers must not depend on orders.',
            },
            {
              target: './src/offers',
              from: './src/payments',
              message: 'Offers must not depend on payments.',
            },
            // orders → no favorites/reviews/loyalty/donations/inventory
            {
              target: './src/orders',
              from: './src/favorites',
              message: 'Orders must not depend on favorites.',
            },
            {
              target: './src/orders',
              from: './src/reviews',
              message: 'Orders must not depend on reviews.',
            },
            {
              target: './src/orders',
              from: './src/loyalty',
              message: 'Orders must not depend on loyalty.',
            },
            {
              target: './src/orders',
              from: './src/donations',
              message: 'Orders must not depend on donations.',
            },
            {
              target: './src/orders',
              from: './src/inventory',
              message: 'Orders must not depend on inventory.',
            },
            // payments → only orders/users/common
            {
              target: './src/payments',
              from: './src/offers',
              message: 'Payments should only depend on orders/users/common.',
            },
            {
              target: './src/payments',
              from: './src/establishments',
              message: 'Payments should only depend on orders/users/common.',
            },
            {
              target: './src/payments',
              from: './src/favorites',
              message: 'Payments should only depend on orders/users/common.',
            },
            {
              target: './src/payments',
              from: './src/loyalty',
              message: 'Payments should only depend on orders/users/common.',
            },
          ],
        },
      ],
    },
  },
];
