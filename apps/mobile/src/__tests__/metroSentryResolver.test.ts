/**
 * Guards the Sentry web-replay exclusion in metro.config.js.
 *
 * THE HISTORY THIS PREVENTS REPEATING
 * -----------------------------------
 * The config used to "stub" @sentry-internal/replay (+ feedback, replay-canvas,
 * browser-utils) through `resolver.extraNodeModules`, with a comment claiming
 * ~400KB savings. It never worked: extraNodeModules is a fallback consulted
 * only when normal node_modules resolution FAILS, and those packages are
 * physically installed, so normal resolution always won. Nothing verified the
 * bundle, so 299 KiB of DOM session-replay source shipped in every production
 * build while the config said otherwise.
 *
 * The working mechanism is Sentry's own `includeWebReplay: false` option on
 * `withSentryConfig`, which installs a resolveRequest interceptor that returns
 * an empty module for /@sentry(-internal)?\/replay/ before node_modules lookup
 * happens. The SDK defaults the option to true, so an SDK upgrade or a config
 * refactor that drops the explicit `false` silently re-ships the dead code -
 * which is exactly the regression this test exists to catch, at the layer
 * where it actually happens (module resolution), not by grepping config text.
 */
/**
 * Local structural types - metro-resolver ships untyped source and pulling in
 * a declaration package for two shapes used only here is not worth the
 * dependency. These mirror the subset of metro-resolver's contract the Sentry
 * interceptor actually touches.
 */
type Resolution = { type: 'empty' } | { type: 'sourceFile'; filePath: string };
interface ResolutionContext {
  resolveRequest: (
    context: ResolutionContext,
    moduleName: string,
    platform: string | null,
  ) => Resolution;
}
type CustomResolver = (
  context: ResolutionContext,
  moduleName: string,
  platform: string | null,
) => Resolution;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const metroConfig = require('../../metro.config.js') as {
  resolver?: { resolveRequest?: CustomResolver; extraNodeModules?: Record<string, string> };
};

/**
 * Minimal context: the Sentry interceptor must answer replay modules BEFORE
 * delegating, so for those the spy must never be called. For anything else it
 * must delegate here.
 */
const makeContext = () => {
  const resolveRequest = jest.fn().mockReturnValue({
    type: 'sourceFile',
    filePath: '/delegated.js',
  });
  return { context: { resolveRequest } as unknown as ResolutionContext, spy: resolveRequest };
};

describe('metro.config.js Sentry web-replay exclusion', () => {
  const resolveRequest = metroConfig.resolver?.resolveRequest;

  it('installs a custom resolveRequest (withSentryConfig includeWebReplay: false)', () => {
    // If this fails, the option was dropped and the SDK default (true) is in
    // effect: the DOM replay bundle ships again.
    expect(typeof resolveRequest).toBe('function');
  });

  it.each(['@sentry-internal/replay', '@sentry-internal/replay-canvas', '@sentry/replay'])(
    'resolves %s to an empty module on android without consulting node_modules',
    moduleName => {
      const { context, spy } = makeContext();
      const result = resolveRequest?.(context, moduleName, 'android');
      expect(result).toEqual({ type: 'empty' });
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('delegates non-replay Sentry modules untouched (browser/browser-utils stay real)', () => {
    // @sentry/browser is a hard dependency of @sentry/react-native by design
    // (event builders, fetch/XHR instrumentation). Emptying it breaks error
    // reporting, so it must pass through to normal resolution.
    for (const moduleName of ['@sentry/browser', '@sentry-internal/browser-utils', 'react']) {
      const { context, spy } = makeContext();
      const result = resolveRequest?.(context, moduleName, 'android');
      expect(result).toEqual({ type: 'sourceFile', filePath: '/delegated.js' });
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('carries no @sentry entries in extraNodeModules (the mechanism that never worked)', () => {
    const keys = Object.keys(metroConfig.resolver?.extraNodeModules ?? {});
    expect(keys.filter(k => k.startsWith('@sentry'))).toEqual([]);
  });
});
