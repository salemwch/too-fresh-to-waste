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
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
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

// MMKV mock
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
  })),
}));

// Reanimated mock
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// react-native-config — stub with empty config for tests
jest.mock('react-native-config', () => ({ Config: {} }));

// Vector icons — handled by moduleNameMapper in jest config
// (maps @react-native-vector-icons/* to jest.vectorIconsStub.js)
