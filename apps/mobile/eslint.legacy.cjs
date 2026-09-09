'use strict';

/** Legacy-format config object, consumed by eslint.config.js via FlatCompat. */
module.exports = {
  root: true,
  /*
   * The lint script is `eslint .`, which without this walks generated output as
   * if it were source. Istanbul writes plain CommonJS into coverage/, so every
   * report emitted `require() style import is forbidden` — six files' worth of
   * errors describing code nobody wrote and nobody can fix. Real problems in
   * src/ were sitting underneath that noise.
   */
  ignorePatterns: [
    'coverage/',
    'android/',
    'ios/',
    'dist/',
    'build/',
    '.metro-cache/',
    'node_modules/',
  ],
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-native-a11y/all',
  ],
  overrides: [
    {
      /*
       * Build tooling config and Node CLI scripts, loaded by Node as CommonJS
       * before any bundler is involved. Metro, Babel and Jest read these with
       * require(), so `import` is not an option here and no-require-imports is
       * reporting the only form that works. `scripts/*.js` are the asset
       * pipeline and its budget guard - same story, run by node, never bundled.
       */
      files: [
        '*.config.js',
        'jest.setup.js',
        '.eslintrc.js',
        'react-native.config.js',
        'metro.config.js',
        'babel.config.js',
        'scripts/**/*.js',
      ],
      // Node/Jest globals: these run outside the app bundle, so the React
      // Native env does not declare `require`, `module`, `__dirname` or `jest`.
      env: { node: true, jest: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      /*
       * App.tsx defers heavy modules — LocalLocationService, Google Sign-In,
       * socketService — until after InteractionManager reports the first
       * interactions are done, so they do not sit on the startup path. Only a
       * few screens need any of them.
       *
       * require() is what makes that possible: `import` is hoisted and
       * evaluated eagerly, so rewriting these to satisfy the rule would pull
       * all three back into the initial bundle evaluation and undo the
       * deferral. Startup cost is a product requirement here, not a
       * preference — see .claude/rules/performance.md ("keep the module graph
       * shallow"). Each call site is typed via `as typeof import(...)`, so the
       * types are still checked.
       */
      files: ['src/App.tsx'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-native-a11y'],
  rules: {
    // The base `dot-notation` rule fights the compiler here: packages/tsconfig/
    // base.json sets `noPropertyAccessFromIndexSignature: true`, so
    // `Config['API_URL']` is REQUIRED — rewriting it to `Config.API_URL` as the
    // rule asks produces TS4111 and does not build. It was emitting 230
    // warnings instructing us to write code that cannot compile.
    //
    // Off rather than swapped for @typescript-eslint/dot-notation: that variant
    // would allow index-signature access correctly, but it needs type-aware
    // linting (parserOptions.project), and turning that on across the app costs
    // far more lint time than this stylistic rule is worth. TypeScript already
    // enforces the only version of this that matters.
    'dot-notation': 'off',
    // Deprecated in ESLint and about a real IE 8 bug (catch parameters leaking
    // into the enclosing scope). Hermes is not IE 8. Kept off so `catch (error)`
    // inside a function that already has an `error` in scope is not flagged —
    // @typescript-eslint/no-shadow covers genuine shadowing.
    'no-catch-shadow': 'off',
    // React Navigation's API *is* render props: `tabBarIcon`, `headerTitle` and
    // `headerRight` are documented as functions returning an element, and the
    // ones inside `screenOptions={({ route }) => ...}` close over `route`, so
    // they cannot be hoisted out. The rule's real target — a component declared
    // in a render body and used as JSX, which remounts its subtree every render
    // — still applies and is still reported.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // `void promise;` is the sanctioned marker for intentional fire-and-forget
    // calls (required to satisfy no-floating-promises). Allow it in statement
    // position while still flagging `void` misuse inside expressions.
    'no-void': ['warn', { allowAsStatement: true }],
    // Arabic is a first-class locale. Physical direction props do not flip
    // under `I18nManager.forceRTL` — only logical ones do. See src/utils/rtl.ts.
    //
    // Two families are deliberately NOT restricted, because in both the
    // symmetric (already RTL-correct) form dominates and flagging it would
    // train people to disable the rule rather than fix anything:
    //   - `left`/`right` insets — `left: 0, right: 0` stretches an element,
    //     it does not anchor it to a side.
    //   - corner radii — 36 of the 42 uses in this app are top-left+top-right
    //     or bottom-left+bottom-right pairs, i.e. "round the top/bottom".
    // Reach for the logical form by hand when a use really is one-sided.
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "Property[key.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth)$/]",
        message:
          'Use the logical property instead (marginStart/marginEnd, paddingStart/paddingEnd, borderStartWidth/borderEndWidth) — physical left/right props do not flip in Arabic.',
      },
      {
        selector: "Property[key.name='textAlign'][value.value=/^(left|right)$/]",
        message:
          "textAlign: 'left'/'right' does not flip in Arabic. Use textAlignStart()/textAlignEnd() from @/utils/rtl, or 'auto'.",
      },
    ],
    // RN-specific accessibility rules
    'react-native-a11y/has-accessibility-props': 'error',
    'react-native-a11y/has-valid-accessibility-role': 'error',
    'react-native-a11y/no-nested-touchables': 'warn',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
};
