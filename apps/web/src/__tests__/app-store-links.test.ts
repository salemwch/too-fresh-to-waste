/**
 * Store-link resolution.
 *
 * The module reads `process.env` once at import time, because Next.js inlines
 * `NEXT_PUBLIC_*` at build time and a per-call lookup would not be substituted
 * in the browser bundle. That makes it awkward to test by assignment, so each
 * case sets the env and re-imports through `jest.isolateModules`, which is the
 * only way to observe a different build-time value.
 */

type StoreLinks = typeof import('@/lib/app-store-links');

function loadWith(env: { android?: string; ios?: string }): StoreLinks {
  const prevAndroid = process.env['NEXT_PUBLIC_PLAY_STORE_URL'];
  const prevIos = process.env['NEXT_PUBLIC_APP_STORE_URL'];

  if (env.android === undefined) delete process.env['NEXT_PUBLIC_PLAY_STORE_URL'];
  else process.env['NEXT_PUBLIC_PLAY_STORE_URL'] = env.android;

  if (env.ios === undefined) delete process.env['NEXT_PUBLIC_APP_STORE_URL'];
  else process.env['NEXT_PUBLIC_APP_STORE_URL'] = env.ios;

  let mod!: StoreLinks;
  jest.isolateModules(() => {
    mod = require('@/lib/app-store-links') as StoreLinks;
  });

  if (prevAndroid === undefined) delete process.env['NEXT_PUBLIC_PLAY_STORE_URL'];
  else process.env['NEXT_PUBLIC_PLAY_STORE_URL'] = prevAndroid;
  if (prevIos === undefined) delete process.env['NEXT_PUBLIC_APP_STORE_URL'];
  else process.env['NEXT_PUBLIC_APP_STORE_URL'] = prevIos;

  return mod;
}

const PLAY = 'https://play.google.com/store/apps/details?id=com.toofreshtowaste.app';
const APPLE = 'https://apps.apple.com/tn/app/too-fresh-to-waste/id123456789';

describe('getStoreUrl', () => {
  it('returns null for both platforms before launch', () => {
    const m = loadWith({});

    expect(m.getStoreUrl('android')).toBeNull();
    expect(m.getStoreUrl('ios')).toBeNull();
  });

  it('treats an empty or whitespace value as unset', () => {
    // A Vercel variable created but left blank is the likely real-world case.
    expect(loadWith({ android: '' }).getStoreUrl('android')).toBeNull();
    expect(loadWith({ android: '   ' }).getStoreUrl('android')).toBeNull();
  });

  it('resolves a valid Play Store URL', () => {
    expect(loadWith({ android: PLAY }).getStoreUrl('android')).toBe(PLAY);
  });

  it('resolves a valid App Store URL', () => {
    expect(loadWith({ ios: APPLE }).getStoreUrl('ios')).toBe(APPLE);
  });

  it('keeps the platforms independent', () => {
    // The expected launch state: Android published, iOS not built yet.
    const m = loadWith({ android: PLAY });

    expect(m.getStoreUrl('android')).toBe(PLAY);
    expect(m.getStoreUrl('ios')).toBeNull();
  });

  describe('rejects a value that is not a real store URL', () => {
    it.each([
      ['not a URL at all', 'toofreshtowaste'],
      ['http rather than https', 'http://play.google.com/store/apps/details?id=x'],
      ['a lookalike host', 'https://play.google.com.evil.test/store/apps/details?id=x'],
      ['some other site', 'https://example.com/download'],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['the wrong store for the platform', APPLE],
    ])('%s', (_label, value) => {
      // A mistyped variable must degrade to the launch modal, which is what
      // null produces - never to a live anchor pointing at whatever was pasted.
      expect(loadWith({ android: value }).getStoreUrl('android')).toBeNull();
    });
  });

  it('accepts the itunes.apple.com legacy host for iOS', () => {
    const legacy = 'https://itunes.apple.com/tn/app/too-fresh-to-waste/id123456789';

    expect(loadWith({ ios: legacy }).getStoreUrl('ios')).toBe(legacy);
  });
});

describe('getPrimaryStoreUrl', () => {
  it('is null until Android is published', () => {
    expect(loadWith({}).getPrimaryStoreUrl()).toBeNull();
  });

  it('follows Android, the only platform this app ships', () => {
    expect(loadWith({ android: PLAY }).getPrimaryStoreUrl()).toBe(PLAY);
  });

  it('stays null when only iOS is set', () => {
    // A generic CTA must not send an Android majority to the App Store.
    expect(loadWith({ ios: APPLE }).getPrimaryStoreUrl()).toBeNull();
  });
});
