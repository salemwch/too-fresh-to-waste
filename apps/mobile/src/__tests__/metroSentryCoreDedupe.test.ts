/**
 * Guards the single-@sentry/core resolution in metro.config.js.
 *
 * pnpm hoists the @sentry/core version web/backend use to the workspace root and
 * gives each mobile Sentry package its own nested copy of the version it needs.
 * Metro bundled every copy: the RN 0.87 production bundle carried four identical
 * @sentry/core 10.73.0 copies (~1.3 MiB). metro.config.js now resolves every
 * @sentry/core request from the copy @sentry/react-native uses - but only when
 * the copy a request would normally get is the SAME version, and fails the build
 * otherwise. These cases drive the real resolver against fake package copies.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

type Resolution = { type: 'empty' } | { type: 'sourceFile'; filePath: string };
interface ResolutionContext {
  originModulePath: string;
  resolveRequest: (
    context: ResolutionContext,
    moduleName: string,
    platform: string | null,
  ) => Resolution;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const metroConfig = require('../../metro.config.js') as {
  resolver: { resolveRequest: ResolutionContext['resolveRequest'] };
};
const resolveRequest = metroConfig.resolver.resolveRequest;

const projectRoot = path.resolve(__dirname, '../..');
const sentryReactNativeDir = path.dirname(
  require.resolve('@sentry/react-native/package.json', { paths: [projectRoot] }),
);
const canonicalCoreDir = path.dirname(
  require.resolve('@sentry/core/package.json', { paths: [sentryReactNativeDir] }),
);
// The package's real entry file, relative to its root - fake copies mirror this
// layout so the test follows @sentry/core's actual structure.
const entryRelative = path.relative(
  canonicalCoreDir,
  require.resolve('@sentry/core', { paths: [sentryReactNativeDir] }),
);
const canonicalVersion = (
  JSON.parse(fs.readFileSync(path.join(canonicalCoreDir, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

/** A throwaway node_modules/@sentry/core copy with the given version. */
const makeCoreCopy = (version: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-core-copy-'));
  const dir = path.join(root, 'node_modules', '@sentry', 'core');
  fs.mkdirSync(path.join(dir, path.dirname(entryRelative)), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: '@sentry/core', version }),
  );
  return dir;
};

/**
 * Normal resolution answers with `firstFile`; resolution from the
 * @sentry/react-native anchor answers with the canonical copy.
 */
const makeContext = (firstFile: string) => {
  const canonicalFile = path.join(canonicalCoreDir, entryRelative);
  const spy = jest.fn((ctx: ResolutionContext): Resolution => ({
    type: 'sourceFile',
    filePath: ctx.originModulePath.startsWith(sentryReactNativeDir) ? canonicalFile : firstFile,
  }));
  const context: ResolutionContext = {
    // Any module outside @sentry/react-native - a request from @sentry/browser.
    originModulePath: path.join(projectRoot, 'node_modules', '@sentry', 'browser', 'index.js'),
    resolveRequest: spy,
  };
  return { context, spy, canonicalFile };
};

describe('metro.config.js single @sentry/core', () => {
  it('keeps a request that already resolves to the canonical copy', () => {
    const { context, spy, canonicalFile } = makeContext(path.join(canonicalCoreDir, entryRelative));
    expect(resolveRequest(context, '@sentry/core', 'android')).toEqual({
      type: 'sourceFile',
      filePath: canonicalFile,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('redirects a nested copy of the same version to the canonical copy', () => {
    const copy = makeCoreCopy(canonicalVersion);
    const { context, spy, canonicalFile } = makeContext(path.join(copy, entryRelative));

    expect(resolveRequest(context, '@sentry/core', 'android')).toEqual({
      type: 'sourceFile',
      filePath: canonicalFile,
    });
    // Second resolution is anchored at @sentry/react-native.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1]?.[0].originModulePath).toBe(
      path.join(sentryReactNativeDir, 'package.json'),
    );
  });

  it('applies to @sentry/core subpaths too', () => {
    const copy = makeCoreCopy(canonicalVersion);
    const { context, spy } = makeContext(
      path.join(copy, path.dirname(entryRelative), 'browser.js'),
    );
    resolveRequest(context, '@sentry/core/browser', 'android');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fails the build rather than merging a different @sentry/core version', () => {
    const copy = makeCoreCopy('0.0.0-different');
    const { context } = makeContext(path.join(copy, entryRelative));
    expect(() => resolveRequest(context, '@sentry/core', 'android')).toThrow(
      /Refusing to merge two different @sentry\/core versions/,
    );
  });

  it('leaves every other module to normal resolution', () => {
    const { context, spy } = makeContext('/somewhere/else.js');
    expect(resolveRequest(context, '@sentry/react', 'android')).toEqual({
      type: 'sourceFile',
      filePath: '/somewhere/else.js',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
