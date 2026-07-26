'use strict';

module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-native-a11y/all',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-native-a11y'],
  rules: {
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
