/**
 * Deep-link query parsing.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every param in linkingConfig arrives through React Navigation's
 * getStateFromPath, which parses the query string with `query-string`, which
 * decodes each value with `decode-uri-component`. That decoder carries an
 * accepted advisory, GHSA-vcc3-ghjq-m6fr, recorded in
 * .claude/rules/dependencies.md. This suite is the evidence behind that
 * acceptance and the guard for the day it can be revisited.
 *
 * The patched 0.5.0 is ESM-only, and query-string 7.1.3 is CommonJS doing
 * `const decodeComponent = require('decode-uri-component')`. Under 0.5.0 that
 * yields the module namespace, so decodeComponent is an object, not a
 * function, and EVERY deep link carrying a query param throws
 * "decodeComponent is not a function". It bundles and type-checks cleanly, so
 * only a test that actually parses a path can see it - which is why 9 of the
 * cases below failed on 0.5.0 and pass on 0.2.2.
 *
 * What rides on this is not cosmetic: `token` drives password reset and email
 * verification. A token that decodes wrong is a reset link that silently stops
 * working, in production, on real users' email.
 *
 * WHAT IS ASSERTED
 * ----------------
 * The four query-bearing routes, plus the decoder's edge classes: values that
 * need no decoding, values that do, and malformed percent-encoding - which is
 * the exact input class the advisory is about. Malformed input must come back
 * as something, not throw, because a crash on a hostile link is the failure
 * mode that actually matters here.
 *
 * Driven through getStateFromPath rather than by calling decode-uri-component
 * directly, so it tests the seam the app actually uses. Mocking query-string
 * or the decoder here would assert nothing about deep links.
 */
import { getStateFromPath } from '@react-navigation/native';

import { linkingConfig } from '../linking';

import type { NavigationState, PartialState } from '@react-navigation/native';

type AnyState = PartialState<NavigationState> | NavigationState | undefined;

// getStateFromPath's own options type is narrower than LinkingOptions['config']
// under exactOptionalPropertyTypes (it wants `initialRouteName?: string`, while
// the param list keys as string | number). The runtime shape is the same object
// React Navigation is handed in production, so this cast changes nothing that
// is executed.
type PathOptions = Parameters<typeof getStateFromPath>[1];
const config = linkingConfig.config as unknown as PathOptions;

type ScreenMap = Record<string, { screens?: Record<string, unknown> } | undefined>;

/** Walks the nested navigator state and returns the named route's params. */
function paramsFor(state: AnyState, routeName: string): Record<string, unknown> | undefined {
  if (!state?.routes) return undefined;
  for (const route of state.routes) {
    if (route.name === routeName) {
      return route.params as Record<string, unknown> | undefined;
    }
    const nested = paramsFor(route.state as AnyState, routeName);
    if (nested) return nested;
  }
  return undefined;
}

const parse = (path: string) => getStateFromPath(path, config);

describe('deep-link config', () => {
  it('declares the query-bearing auth routes, so the cases below cannot pass vacuously', () => {
    const authScreens = (linkingConfig.config?.screens as ScreenMap | undefined)?.['AuthStack']
      ?.screens;
    expect(authScreens).toBeDefined();
    for (const name of ['ResetPassword', 'VerifyEmail', 'Register', 'VerifyPhone']) {
      expect(Object.keys(authScreens ?? {})).toContain(name);
    }
  });

  it('accepts the production universal-link origin and the dev scheme', () => {
    // A prefix dropped here means email links open the browser, not the app.
    expect(linkingConfig.prefixes).toEqual(
      expect.arrayContaining(['foodwaste://', 'https://toofreshtowaste.com']),
    );
  });
});

describe('query params reach the screen that needs them', () => {
  it('carries the reset-password token', () => {
    const params = paramsFor(parse('reset-password?token=abc123'), 'ResetPassword');
    expect(params).toEqual(expect.objectContaining({ token: 'abc123' }));
  });

  it('carries both verify-email params', () => {
    // status is set by the web fallback redirect; token by the email link.
    const params = paramsFor(parse('verify-email?token=xyz789&status=success'), 'VerifyEmail');
    expect(params).toEqual(expect.objectContaining({ token: 'xyz789', status: 'success' }));
  });

  it('carries the register referral code', () => {
    const params = paramsFor(parse('register?referralCode=FRIEND50'), 'Register');
    expect(params).toEqual(expect.objectContaining({ referralCode: 'FRIEND50' }));
  });

  it('leaves the token absent rather than empty when the link carries no query', () => {
    // ResetPassword must be able to tell "no token" from "token: ''", because
    // one is a malformed link and the other is a link it should reject.
    const params = paramsFor(parse('reset-password'), 'ResetPassword');
    expect(params?.['token']).toBeUndefined();
  });
});

describe('percent-decoding, the behaviour that blocks the 0.5.0 upgrade', () => {
  it('returns a token that needs no decoding byte for byte', () => {
    // Base64url tokens are the common case and contain nothing to decode.
    const token = 'eyJhbGciOiJIUzI1NiJ9.abc-_123';
    const params = paramsFor(parse(`reset-password?token=${token}`), 'ResetPassword');
    expect(params?.['token']).toBe(token);
  });

  it('decodes a percent-encoded token back to its original bytes', () => {
    // Standard base64 tokens carry + / and =, which are encoded in a query.
    const raw = 'a+b/c=d';
    const params = paramsFor(
      parse(`reset-password?token=${encodeURIComponent(raw)}`),
      'ResetPassword',
    );
    expect(params?.['token']).toBe(raw);
  });

  it('decodes multi-byte UTF-8 in a referral code', () => {
    const raw = 'café-تونس';
    const params = paramsFor(parse(`register?referralCode=${encodeURIComponent(raw)}`), 'Register');
    expect(params?.['referralCode']).toBe(raw);
  });

  it('applies the explicit decodeURIComponent on verify-phone', () => {
    // This route decodes a second time in its own parse function, so a
    // Tunisian number written as %2B216... must arrive as +216...
    const params = paramsFor(parse('verify-phone?phoneNumber=%2B21612345678'), 'VerifyPhone');
    expect(params?.['phoneNumber']).toBe('+21612345678');
  });

  it('does not throw on malformed percent-encoding, the advisory input class', () => {
    // A truncated escape is exactly what a hostile or mangled link contains.
    // The requirement is that the app survives it and the user sees the
    // screen's own invalid-token handling, not a crash on launch.
    expect(() => parse('reset-password?token=%E0%A4%A')).not.toThrow();
    const params = paramsFor(parse('reset-password?token=%E0%A4%A'), 'ResetPassword');
    expect(typeof params?.['token']).toBe('string');
  });

  it('does not throw on a lone percent sign', () => {
    expect(() => parse('reset-password?token=100%')).not.toThrow();
  });
});
