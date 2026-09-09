/**
 * Web ESLint config (flat, ESLint 9).
 *
 * `next lint` is removed in Next.js 16 and `eslint-config-next@16` requires
 * ESLint >= 9, so this workspace moves to the ESLint CLI at the same time as
 * the flat-config migration.
 *
 * eslint-config-next still ships in the legacy `extends` format, so it comes
 * through FlatCompat rather than being spread directly.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      'public/**',
      // Playwright's generated report/artifacts, not source
      'playwright-report/**',
      'test-results/**',
    ],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript', 'plugin:jsx-a11y/recommended'),

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-unescaped-entities': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  /*
   * Node config files, loaded by Node as CommonJS before any bundler runs.
   * next.config.js and jest.config.js are read with require(), so `import` is
   * not available and the rule is reporting the only form that works. The
   * mobile config carries the same exemption for the same reason.
   */
  {
    files: ['*.config.js', '*.config.cjs', 'jest.setup.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  /*
   * Playwright specs and fixtures are not React. Playwright's fixture API is
   * `async ({ page }, use) => { await use(value) }`, and the React Hooks plugin
   * matched that `use` against React's `use()` hook - reporting that
   * "visualPage", "theme" and "locale" are not components. Three false
   * positives from one naming collision, so the React rules are scoped off
   * here rather than the reports being individually silenced.
   */
  {
    files: ['tests/**/*.{ts,tsx}', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
