// Stub for web-only Sentry modules that Metro pulls into the mobile bundle.
// @sentry-internal/replay, /feedback, /replay-canvas, and /browser-utils
// are re-exported by @sentry/browser but never used on React Native.
// Stubbing them saves ~400KB from the JS bundle.
module.exports = {};
