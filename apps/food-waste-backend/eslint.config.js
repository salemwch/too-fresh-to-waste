const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
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