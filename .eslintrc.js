module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    projectService: true,
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-native',
    'security',
    'import',
    'prettier',
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        projectService: true,
      },
    },
  },
  rules: {
    // TypeScript specific rules - BALANCED (Enterprise-grade but practical)
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn', // Downgrade from error - allow with justification
    '@typescript-eslint/no-unsafe-assignment': 'warn', // Downgrade - common in RN with theme/style objects
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Downgrade - not always necessary
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/strict-boolean-expressions': ['error', {
      allowString: true, // Allow string in conditionals (common pattern)
      allowNumber: true, // Allow number in conditionals
      allowNullableObject: true, // Allow nullable objects
      allowNullableBoolean: false, // Still catch boolean issues
      allowNullableString: false, // Still catch string issues
      allowNullableNumber: false, // Still catch number issues
      allowAny: false,
    }],
    '@typescript-eslint/switch-exhaustiveness-check': 'warn', // Downgrade - helpful but not critical
    '@typescript-eslint/prefer-readonly': 'off', // Too pedantic for rapid development
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off', // Off - inference is good enough
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Off - inference is good enough
    '@typescript-eslint/no-floating-promises': 'error', // Keep strict - real bug catcher
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'warn', // Downgrade - sometimes intentional
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-import-type-side-effects': 'error',

    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in RN
    'react/prop-types': 'off', // Using TypeScript
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-wrap-multilines': ['error', {
      declaration: 'parens-new-line',
      assignment: 'parens-new-line',
      return: 'parens-new-line',
      arrow: 'parens-new-line',
    }],
    'react/self-closing-comp': 'error',
    'react/jsx-boolean-value': ['error', 'never'],
    'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
    'react/jsx-fragments': ['error', 'syntax'],
    'react/jsx-no-useless-fragment': 'error',

    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // React Native specific
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off', // Can be too restrictive
    'react-native/sort-styles': 'off', // Prefer manual control

    // Security rules (disabled due to plugin compatibility issues with ESLint 8.x)
    // TODO: Re-enable when a compatible version is available
    // 'security/detect-object-injection': 'error',
    // 'security/detect-non-literal-regexp': 'error',
    // 'security/detect-non-literal-fs-filename': 'off',
    // 'security/detect-unsafe-regex': 'error',
    // 'security/detect-buffer-noassert': 'error',
    // 'security/detect-child-process': 'error',
    // 'security/detect-disable-mustache-escape': 'error',
    // 'security/detect-eval-with-expression': 'error',
    // 'security/detect-no-csrf-before-method-override': 'error',
    // 'security/detect-possible-timing-attacks': 'error',
    // 'security/detect-pseudoRandomBytes': 'error',

    // Import rules
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'type',
      ],
      'newlines-between': 'always',
      'alphabetize': { order: 'asc', caseInsensitive: true },
    }],
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    'import/no-duplicates': 'error',
    'import/default': 'off', // Disabled for React 19+ which uses named exports only

    // General JavaScript rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'no-else-return': 'error',
    'no-lonely-if': 'error',
    'no-unneeded-ternary': 'error',
    'prefer-object-spread': 'error',

    // Prettier integration
    'prettier/prettier': ['error', {
      endOfLine: 'auto',
    }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        // 'security/detect-object-injection': 'off',
      },
    },
    {
      files: ['**/*.js', '**/*.jsx'],
      parserOptions: {
        projectService: false,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/switch-exhaustiveness-check': 'off',
      },
    },
    {
      files: ['apps/mobile/**/*'],
      rules: {
        'react-native/no-raw-text': 'off',
      },
    },
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
  ],
};