/**
 * Mobile ESLint config (flat, ESLint 9).
 *
 * The rules themselves live in eslint.legacy.cjs, unchanged, and are converted
 * here by FlatCompat. That file carries a written justification for nearly
 * every rule - the RTL restrictions on physical margin/padding props, the
 * require() exemptions that keep deferred startup modules off the initial
 * bundle, the dot-notation note about noPropertyAccessFromIndexSignature.
 * Hand-porting it into flat form is precisely how that reasoning gets dropped,
 * so only the wrapper is new.
 */
'use strict';

const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const globals = require('globals');

const legacyConfig = require('./eslint.legacy.cjs');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// `root` and `ignorePatterns` have no meaning in flat config: the first is
// implicit (flat configs never cascade upward), the second becomes a top-level
// `ignores` entry. Directory patterns need a `**` suffix to keep matching.
const { root: _root, ignorePatterns = [], ...rest } = legacyConfig;

module.exports = [
  { ignores: ignorePatterns.map(p => (p.endsWith('/') ? `${p}**` : p)) },
  ...compat.config(rest),

  /*
   * Node scripts under tools/ run in Node, never in the app bundle, so they use
   * Buffer, process and friends. The legacy config declared `env: { node: true }`
   * for a hardcoded list of filenames that predates this directory, so
   * server.mjs was linted with React Native globals only and reported
   * `'Buffer' is not defined`. Scoping by directory instead of by filename
   * means a second tool script does not have to be added to a list.
   */
  {
    files: ['tools/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
];
