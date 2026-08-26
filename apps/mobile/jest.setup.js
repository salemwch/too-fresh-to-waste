/**
 * Jest Setup — Native Module Mocks
 *
 * React Native modules that rely on native code must be mocked
 * in the test environment. Add mocks here as needed.
 */

// AsyncStorage mock
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Haptic feedback mock
/*
 * The default export alone is not enough: src/utils/haptics.ts reads
 * HapticFeedbackTypes at module scope to build its presets, so any suite whose
 * tree reaches it (OrderSuccessModal, and therefore CheckoutScreen) failed to
 * load entirely with "Cannot read properties of undefined (reading
 * 'impactLight')" - an import-time crash, not a test failure, so it read as a
 * broken suite rather than a missing mock.
 *
 * Values mirror the real enum's string members; nothing asserts on them, they
 * only have to exist.
 */
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    selection: 'selection',
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError',
    effectClick: 'effectClick',
    effectDoubleClick: 'effectDoubleClick',
    effectHeavyClick: 'effectHeavyClick',
    effectTick: 'effectTick',
  },
}));

// Linear gradient mock
jest.mock('react-native-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return View;
});

// FastImage mock
jest.mock('react-native-fast-image', () => {
  const React = jest.requireActual('react');
  const { Image } = jest.requireActual('react-native');

  const MockFastImage = React.forwardRef((props, ref) =>
    React.createElement(Image, {
      ...props,
      ref,
    }),
  );

  MockFastImage.displayName = 'FastImage';
  MockFastImage.resizeMode = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  };
  MockFastImage.priority = {
    low: 'low',
    normal: 'normal',
    high: 'high',
  };
  MockFastImage.cacheControl = {
    immutable: 'immutable',
    web: 'web',
    cacheOnly: 'cacheOnly',
  };
  MockFastImage.preload = jest.fn();
  MockFastImage.clearMemoryCache = jest.fn();
  MockFastImage.clearDiskCache = jest.fn();

  return MockFastImage;
});

// MMKV mock.
//
// The app is on MMKV v4, which exposes `createMMKV()` rather than the v3 `MMKV`
// class, and uses `remove()` rather than `delete()` (a reserved word in C++).
// This mock previously only provided the v3 class, so anything importing
// src/storage/mmkv — which creates its stores at module scope — died with
// "createMMKV is not a function" before a single test ran.
//
// Backed by a real Map per store id rather than bare jest.fn()s: several call
// sites write a value and read it back (the offline write queue, the query
// persister), and stubs returning undefined make those silently no-op.
jest.mock('react-native-mmkv', () => {
  const stores = new Map();

  const createMMKV = (config = {}) => {
    const id = config.id ?? 'default';
    if (!stores.has(id)) stores.set(id, new Map());
    const store = stores.get(id);

    return {
      set: (key, value) => store.set(key, value),
      getString: key => store.get(key),
      getNumber: key => store.get(key),
      getBoolean: key => store.get(key),
      remove: key => store.delete(key),
      contains: key => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => Array.from(store.keys()),
    };
  };

  return {
    createMMKV,
    // Kept for any straggler still constructing the v3 class.
    MMKV: jest.fn().mockImplementation(config => createMMKV(config)),
  };
});

// No reanimated mock: the package was removed in favour of React Native's own
// Animated API, which the RN Jest preset already handles.

// react-native-config — stub with empty config for tests
jest.mock('react-native-config', () => ({ Config: {} }));

// react-native-localize — reads the device locale through a TurboModule, which
// is not registered in the Jest runtime, so importing it throws
// "RNLocalize could not be found" and takes the whole suite down with it.
//
// This is not niche: src/i18n imports it, and i18n is reachable from apiClient,
// so any component that ends up touching the API client transitively needs this
// mock. Returning a fixed en-US locale keeps translation output deterministic.
jest.mock('react-native-localize', () => ({
  getLocales: () => [
    { countryCode: 'US', languageTag: 'en-US', languageCode: 'en', isRTL: false },
  ],
  findBestLanguageTag: () => ({ languageTag: 'en-US', isRTL: false }),
  getNumberFormatSettings: () => ({ decimalSeparator: '.', groupingSeparator: ',' }),
  getCalendar: () => 'gregorian',
  getCountry: () => 'US',
  getCurrencies: () => ['TND'],
  getTemperatureUnit: () => 'celsius',
  getTimeZone: () => 'Africa/Tunis',
  uses24HourClock: () => true,
  usesMetricSystem: () => true,
  usesAutoDateAndTime: () => true,
  usesAutoTimeZone: () => true,
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
}));

// Vector icons — handled by moduleNameMapper in jest config
// (maps @react-native-vector-icons/* to jest.vectorIconsStub.js)

// ---------------------------------------------------------------------------
// i18next — real instance, English resources.
//
// Components call useTranslation(); without an initialised instance react-i18next
// warns NO_I18NEXT_INSTANCE and t() returns the raw key, which breaks any test
// asserting on visible text. Initialising here (rather than mocking t) means
// tests exercise the real translation path and catch missing/renamed keys.
// ---------------------------------------------------------------------------
const i18next = require('i18next');
const { initReactI18next } = require('react-i18next');
const enTranslations = require('./src/i18n/locales/en.json');

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: enTranslations } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
