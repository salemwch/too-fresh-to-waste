/**
 * The connectivity toasts are shown from a NetInfo listener, outside React, so
 * they cannot use useTranslation(). They used to be hardcoded English and
 * showed English to French and Arabic users. This drives the real listener in
 * each locale and asserts the copy that reaches Toast.show, so a regression to
 * literal strings fails here rather than on a device with the network off.
 */
import { addEventListener } from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import i18n from '@/i18n';
import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

import { offlineManager } from '../offlineManager';

import type { NetInfoState } from '@react-native-community/netinfo';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock('../logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../safeAnalytics', () => ({ SafeAnalytics: { track: jest.fn() } }));

const mockAddEventListener = addEventListener as jest.Mock;
const mockShow = Toast.show as jest.Mock;

type ToastArgs = { type: string; text1: string; text2: string; onHide?: () => void };

const LOCALES = { en, fr, ar } as const;

/** Emits a connectivity change through the listener offlineManager registered. */
const emit = (isConnected: boolean): void => {
  const listener = mockAddEventListener.mock.calls.at(-1)?.[0] as (s: NetInfoState) => void;
  listener({ isConnected, isInternetReachable: isConnected, type: 'wifi' } as NetInfoState);
};

const lastToast = (): ToastArgs => mockShow.mock.calls.at(-1)?.[0] as ToastArgs;

/**
 * Shared across every locale block, not reset per block: offlineManager is a
 * singleton whose rate-limit timestamp outlives a test, so each case must start
 * later than the last one did.
 */
let clock = Date.parse('2026-10-07T09:00:00.000Z');

describe.each(Object.entries(LOCALES))('connectivity toasts in %s', (locale, messages) => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // The offline toast is rate-limited to one per 5 s across the whole app;
    // each case starts well clear of the previous one.
    clock += 60_000;
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(clock);
    await i18n.changeLanguage(locale);
    offlineManager.initialize();
  });

  afterEach(async () => {
    nowSpy.mockRestore();
    offlineManager.cleanup();
    await i18n.changeLanguage('en');
  });

  it('warns in the current language when the connection drops, then confirms its return', () => {
    emit(false);

    const offline = lastToast();
    expect(offline.type).toBe('warning');
    expect(offline.text1).toBe(messages.common.noInternetConnection);
    expect(offline.text2).toBe(messages.common.offlineFeaturesLimited);
    // Hiding is what lets the next offline toast through.
    offline.onHide?.();

    emit(true);

    const online = lastToast();
    expect(online.type).toBe('success');
    expect(online.text1).toBe(messages.common.backOnline);
    expect(online.text2).toBe(messages.common.connectionRestored);
  });
});

it('the three locales really differ, so the per-locale assertions are not vacuous', () => {
  const offlineTitles = Object.values(LOCALES).map(m => m.common.noInternetConnection);

  expect(new Set(offlineTitles).size).toBe(3);
});
