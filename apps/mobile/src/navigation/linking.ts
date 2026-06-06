/**
 * Deep Linking Configuration
 *
 * Handles two link types:
 *   1. Custom scheme  — foodwaste://  (development, QR codes)
 *   2. Universal Links — https://toofreshtowaste.com  (production email links)
 *
 * Universal Links require:
 *   - Android: assetlinks.json at /.well-known/assetlinks.json (autoVerify in manifest)
 *   - iOS:     apple-app-site-association at /.well-known/apple-app-site-association
 *              + Associated Domains entitlement in Xcode (applinks:toofreshtowaste.com)
 *
 * Path ↔ Screen mapping (consistent with Next.js web URL structure):
 *   /verify-email      → AuthStack › VerifyEmail   (email magic link)
 *   /reset-password    → AuthStack › ResetPassword (password reset)
 *   /login             → AuthStack › Login
 *   /register          → AuthStack › Register
 *   /forgot-password   → AuthStack › ForgotPassword
 *   /verify-phone      → AuthStack › VerifyPhone
 *   /mfa-verification  → AuthStack › MFAVerification
 *   /app               → MainStack
 */

import { AppState, Linking } from 'react-native';

import { Logger } from '@/utils/logger';

import type { RootNavigatorParamList } from './types';
import type { LinkingOptions } from '@react-navigation/native';

// Tracks the last deep link URL we processed, so the AppState recovery
// mechanism doesn't re-dispatch a URL that was already handled normally.
let lastProcessedDeepLink: string | null = null;

export const linkingConfig: LinkingOptions<RootNavigatorParamList> = {
  prefixes: ['foodwaste://', 'https://toofreshtowaste.com', 'https://www.toofreshtowaste.com'],

  config: {
    screens: {
      AuthStack: {
        // No path prefix — auth screens live at URL root, matching the web app's structure.
        // e.g. https://toofreshtowaste.com/verify-email maps directly to VerifyEmail.
        screens: {
          Welcome: 'welcome',
          Login: 'login',
          Register: {
            path: 'register',
            parse: {
              referralCode: (referralCode: string) => referralCode,
            },
          },
          ForgotPassword: 'forgot-password',
          ResetPassword: {
            // Backend redirects password-reset emails to /reset-password?token=...
            path: 'reset-password',
            parse: {
              token: (token: string) => token,
            },
          },
          VerifyEmail: {
            // Email magic links land on /verify-email?token=...
            // Email is intentionally absent from the URL (prevents user enumeration).
            // status param is set by the web fallback redirect after browser-side verification.
            path: 'verify-email',
            parse: {
              token: (token: string) => token,
              status: (status: string) => status,
            },
          },
          VerifyPhone: {
            path: 'verify-phone',
            parse: {
              phoneNumber: (phoneNumber: string) => decodeURIComponent(phoneNumber),
            },
          },
          MFAVerification: 'mfa-verification',
        },
      },
      MainStack: 'app',
    },
  } as NonNullable<LinkingOptions<RootNavigatorParamList>['config']>,

  /**
   * Cold-start: URL that launched the app from a terminated state.
   * CRITICAL: must return the actual URL, not null.
   */
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (typeof url === 'string' && url !== '') {
      Logger.debug('[DeepLink] Cold-start URL', { url });
      lastProcessedDeepLink = url;
    }
    return url;
  },

  /**
   * Warm-start: incoming link while the app is already running.
   * Returns the unsubscribe function — React Navigation calls it on cleanup.
   *
   * Also recovers deep links that were dropped by RN 0.81 Bridgeless mode:
   * when onNewIntent fires before the React context is ready, the URL event
   * is silently lost. MainActivity.setIntent() caches the intent, and the
   * AppState listener picks it up when the app returns to foreground.
   */
  subscribe(listener) {
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      Logger.debug('[DeepLink] Incoming URL', { url });
      lastProcessedDeepLink = url;
      listener(url);
    });

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void Linking.getInitialURL().then(url => {
          if (typeof url === 'string' && url !== '' && url !== lastProcessedDeepLink) {
            Logger.info('[DeepLink] Recovered dropped URL on app resume', { url });
            lastProcessedDeepLink = url;
            listener(url);
          }
        });
      }
    });

    return () => {
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a custom-scheme deep link (dev / QR codes). */
export const buildDeepLink = (screen: string, params?: Record<string, string | number>): string => {
  let url = `foodwaste://${screen}`;
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }
  return url;
};

/** Build a Universal Link (shareable, works on web + opens app if installed). */
export const buildUniversalLink = (
  screen: string,
  params?: Record<string, string | number>,
): string => {
  let url = `https://toofreshtowaste.com/${screen}`;
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }
  return url;
};
