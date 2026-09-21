/**
 * Web ESLint config (flat, ESLint 9).
 *
 * `next lint` is removed in Next.js 16 and `eslint-config-next@16` requires
 * ESLint >= 9, so this workspace uses the ESLint CLI directly.
 *
 * eslint-config-next 16 ships native flat config - `core-web-vitals` and
 * `typescript` are plain config arrays - so they are spread rather than passed
 * through FlatCompat. Under 15 they were legacy `extends` objects and needed
 * the bridge; feeding a flat array to FlatCompat throws on a circular structure
 * while it tries to serialise the plugin objects for schema validation.
 *
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

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

  ...nextCoreWebVitals,
  ...nextTypeScript,

  /*
   * jsx-a11y's full recommended set, applied as rules only.
   *
   * eslint-config-next 16 registers the jsx-a11y plugin itself, so extending
   * its recommended config on top now throws "Cannot redefine plugin". But
   * Next only enables 6 of the 34 recommended rules, so simply dropping the
   * extend would quietly cut accessibility coverage by 28 rules - a real
   * regression wearing the costume of a config cleanup. Spreading the ruleset
   * keeps every rule the app had under Next 15 without touching registration.
   */
  {
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },

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
   * Dates and numbers must be formatted in the *app's* locale, not the
   * browser's.
   *
   * `value.toLocaleString()` with no argument formats in whatever locale the
   * viewer's browser is set to. A French admin on an en-US machine then reads
   * "1,234" and "3/12/2026" on an otherwise French page. Passing a hardcoded
   * 'en-GB' or 'en-US' is the same bug wearing a disguise - it just picks the
   * wrong locale deliberately.
   *
   * 69 call sites across 21 admin files had this before the rule existed, and
   * the reason it spread is that every one of them looks correct in isolation
   * and renders perfectly for an English reviewer. A rule in a document cannot
   * catch that; this can.
   *
   * Use `useFormat()` from `@/lib/use-format`, or the `format*` helpers in
   * `@/lib/format` with an explicit `locale` from `useLocale()`.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/][arguments.length=0]",
          message:
            'Formats in the browser locale, not the app locale. Use useFormat() from @/lib/use-format, or pass a locale from useLocale().',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/] > Literal.arguments:first-child[value=/^[a-z]{2}(-[A-Z]{2})?$/]",
          message:
            'Hardcoded locale. The app has three (en/fr/ar) - use useFormat() from @/lib/use-format so the output follows the reader.',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/] > Identifier.arguments:first-child[name='undefined']",
          message:
            'Passing undefined as the locale falls back to the browser locale. Use useFormat() from @/lib/use-format.',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/] > ArrayExpression.arguments:first-child[elements.length=0]",
          message:
            'An empty locales list falls back to the browser locale. Use useFormat() from @/lib/use-format.',
        },
      ],
    },
  },

  /*
   * The formatters themselves are where `Intl` is allowed to be called
   * directly - that is their job.
   */
  {
    files: ['src/lib/format.ts', 'src/lib/use-format.ts'],
    rules: { 'no-restricted-syntax': 'off' },
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
