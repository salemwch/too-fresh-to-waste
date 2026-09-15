/**
 * Jest SVG Stub
 *
 * `react-native-svg-transformer` turns an `.svg` import into a React component
 * at build time. The shared asset stub returns `''`, which is right for a
 * `.png` (an image source) and wrong for an `.svg` (a component) — rendering
 * `<Icon />` where `Icon` is `''` throws "Element type is invalid".
 *
 * So SVGs get their own stub: a real component that accepts `SvgProps` and
 * renders a host view. Tests can then assert on the icon's presence and on the
 * `color` prop the duotone icons tint from, which is the behaviour that
 * actually matters — a chip's selected state is carried by that prop.
 *
 * Mapped ahead of the shared `\.(ttf|otf|png|…|svg)$` entry in
 * `jest.config.js`; Jest matches `moduleNameMapper` keys in insertion order.
 */
/*
 * `require` is mandatory here, not a style choice: Jest resolves
 * `moduleNameMapper` targets through CommonJS, so this file cannot use ESM
 * imports. The sibling stubs (`jest.assetStub.js`, `jest.vectorIconsStub.js`)
 * avoid the rule only because they export a literal and need no imports.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const React = require('react');
const { View } = require('react-native');
/* eslint-enable @typescript-eslint/no-require-imports */

const SvgStub = React.forwardRef((props, ref) =>
  React.createElement(View, {
    ref,
    testID: props.testID ?? 'svg-icon',
    accessible: false,
    // Surfaced so tests can assert the tint without reaching into SVG internals.
    'data-color': props.color,
    ...props,
  }),
);

SvgStub.displayName = 'SvgStub';

module.exports = SvgStub;
module.exports.default = SvgStub;
