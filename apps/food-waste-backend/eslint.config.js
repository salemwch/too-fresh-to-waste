const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const path = require('path');

module.exports = [
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
      '**/seeds/**'
    ],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: [path.resolve(__dirname, './tsconfig.eslint.json')],
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2022,
        createDefaultProgram: false,
        extraFileExtensions: ['.ts'],
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
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
    rules: {
      // TypeScript specific rules - Enterprise grade
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true,
      }],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires strictNullChecks
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'off', // Requires strictNullChecks
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',

      // General ESLint rules - Production ready
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Import and spacing rules
      'eqeqeq': ['error', 'always'],
      'curly': 'error',
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Async/await rules - Critical for Node.js
      'require-await': 'error',
      'no-return-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // Security rules
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',

      // NestJS specific allowances
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/ban-types': 'off',
      'prefer-rest-params': 'off',
      '@typescript-eslint/no-namespace': 'off', // Allow namespaces for DTOs
      '@typescript-eslint/parameter-properties': 'off', // NestJS uses constructor injection

      // Module Boundary Rules - Enforce Modular Monolith Architecture (WARN mode)
      'import/no-restricted-paths': ['warn', {
        zones: [
          // Common module boundaries
          { target: './src/common', from: './src/auth', message: 'Common should not depend on auth. Move shared code or use DI.' },
          { target: './src/common', from: './src/users', message: 'Common should not depend on users. Move shared code or use DI.' },
          { target: './src/common', from: './src/orders', message: 'Common should not depend on orders. Move shared code or use DI.' },
          { target: './src/common', from: './src/payments', message: 'Common should not depend on payments. Move shared code or use DI.' },
          { target: './src/common', from: './src/offers', message: 'Common should not depend on offers. Move shared code or use DI.' },
          { target: './src/common', from: './src/establishments', message: 'Common should not depend on establishments.' },
          { target: './src/common', from: './src/favorites', message: 'Common should not depend on favorites.' },
          { target: './src/common', from: './src/reviwes', message: 'Common should not depend on reviews.' },
          { target: './src/common', from: './src/loyalty', message: 'Common should not depend on loyalty.' },
          { target: './src/common', from: './src/donations', message: 'Common should not depend on donations.' },
          { target: './src/common', from: './src/inventory', message: 'Common should not depend on inventory.' },
          { target: './src/common', from: './src/analytics', message: 'Common should not depend on analytics.' },
          { target: './src/common', from: './src/notifications', message: 'Common should not depend on notifications.' },
          { target: './src/common', from: './src/moderation', message: 'Common should not depend on moderation.' },
          { target: './src/common', from: './src/geolocation', message: 'Common should not depend on geolocation.' },
          { target: './src/common', from: './src/search', message: 'Common should not depend on search.' },
          { target: './src/common', from: './src/health', message: 'Common should not depend on health.' },
          { target: './src/common', from: './src/admin', message: 'Common should not depend on admin.' },

          // Auth module boundaries
          { target: './src/auth', from: './src/orders', message: 'Auth should not depend on orders. Use events instead.' },
          { target: './src/auth', from: './src/payments', message: 'Auth should not depend on payments. Use events instead.' },
          { target: './src/auth', from: './src/offers', message: 'Auth should not depend on offers. Use events instead.' },
          { target: './src/auth', from: './src/establishments', message: 'Auth should not depend on establishments.' },
          { target: './src/auth', from: './src/favorites', message: 'Auth should not depend on favorites.' },
          { target: './src/auth', from: './src/reviwes', message: 'Auth should not depend on reviews.' },
          { target: './src/auth', from: './src/loyalty', message: 'Auth should not depend on loyalty.' },
          { target: './src/auth', from: './src/donations', message: 'Auth should not depend on donations.' },
          { target: './src/auth', from: './src/inventory', message: 'Auth should not depend on inventory.' },
          { target: './src/auth', from: './src/analytics', message: 'Auth should not depend on analytics.' },

          // Users module boundaries
          { target: './src/users', from: './src/orders', message: 'Users should not depend on orders. Use events instead.' },
          { target: './src/users', from: './src/payments', message: 'Users should not depend on payments. Use events instead.' },
          { target: './src/users', from: './src/offers', message: 'Users should not depend on offers. Use events instead.' },
          { target: './src/users', from: './src/establishments', message: 'Users should not depend on establishments.' },
          { target: './src/users', from: './src/favorites', message: 'Users should not depend on favorites. Use events instead.' },
          { target: './src/users', from: './src/reviwes', message: 'Users should not depend on reviews.' },
          { target: './src/users', from: './src/loyalty', message: 'Users should not depend on loyalty.' },
          { target: './src/users', from: './src/donations', message: 'Users should not depend on donations.' },
          { target: './src/users', from: './src/inventory', message: 'Users should not depend on inventory.' },
          { target: './src/users', from: './src/analytics', message: 'Users should not depend on analytics.' },

          // Offers module boundaries
          { target: './src/offers', from: './src/orders', message: 'Offers should not depend on orders. Use events instead.' },
          { target: './src/offers', from: './src/payments', message: 'Offers should not depend on payments. Use events instead.' },
          { target: './src/offers', from: './src/favorites', message: 'Offers should not depend on favorites. Use events instead.' },
          { target: './src/offers', from: './src/reviwes', message: 'Offers should not depend on reviews.' },
          { target: './src/offers', from: './src/loyalty', message: 'Offers should not depend on loyalty.' },
          { target: './src/offers', from: './src/donations', message: 'Offers should not depend on donations.' },
          { target: './src/offers', from: './src/inventory', message: 'Offers should not depend on inventory.' },
          { target: './src/offers', from: './src/analytics', message: 'Offers should not depend on analytics.' },

          // Orders module boundaries
          { target: './src/orders', from: './src/favorites', message: 'Orders should not depend on favorites. Use events instead.' },
          { target: './src/orders', from: './src/reviwes', message: 'Orders should not depend on reviews. Use events instead.' },
          { target: './src/orders', from: './src/loyalty', message: 'Orders should not depend on loyalty. Use events instead.' },
          { target: './src/orders', from: './src/donations', message: 'Orders should not depend on donations. Use events instead.' },
          { target: './src/orders', from: './src/inventory', message: 'Orders should not depend on inventory. Use events instead.' },
          { target: './src/orders', from: './src/analytics', message: 'Orders should not depend on analytics.' },

          // Payments module boundaries
          { target: './src/payments', from: './src/offers', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/establishments', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/favorites', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/reviwes', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/loyalty', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/donations', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/inventory', message: 'Payments should only depend on orders/users/common.' },
          { target: './src/payments', from: './src/analytics', message: 'Payments should only depend on orders/users/common.' },
        ],
      }],
    },
  },
  {
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];