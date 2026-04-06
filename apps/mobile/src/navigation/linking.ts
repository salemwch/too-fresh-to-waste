/**
 * Deep Linking Configuration
 * Defines URL schemes and screen mappings for deep links
 * Supports both custom URL scheme (foodwaste://) and universal links (https://foodwasteapp.com)
 */

import { Linking } from 'react-native';

import { Logger } from '@/utils/logger';

import type { RootNavigatorParamList } from './types';
import type { LinkingOptions } from '@react-navigation/native';

/**
 * Linking configuration for React Navigation
 * Maps URLs to app screens
 */
export const linkingConfig: LinkingOptions<RootNavigatorParamList> = {
  prefixes: ['foodwaste://', 'https://foodwasteapp.com', 'https://www.foodwasteapp.com'],

  config: {
    screens: {
      AuthStack: {
        path: 'auth',
        screens: {
          Welcome: 'welcome',
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          ResetPassword: {
            path: 'reset-password',
            parse: {
              email: (email: string) => decodeURIComponent(email),
              token: (token: string) => token,
            },
          },
          VerifyEmail: {
            path: 'verify-email',
            parse: {
              email: (email: string) => decodeURIComponent(email),
              token: (token: string) => token,
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
   * Handle initial URL for cold-start deep links
   * CRITICAL: Must return the actual URL, not null!
   */
  async getInitialURL() {
    // Get the URL that opened the app (cold start)
    const url = await Linking.getInitialURL();

    if (typeof url === 'string' && url !== '') {
      Logger.debug('[DeepLink] Initial URL', { url });
    }

    return url;
  },

  /**
   * Subscribe to incoming links while app is running (warm start)
   * CRITICAL: Must properly subscribe to link events!
   */
  subscribe(listener) {
    // Listen for incoming URLs when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      Logger.debug('[DeepLink] Incoming URL', { url });
      listener(url);
    });

    // Return unsubscribe function
    return () => {
      subscription.remove();
    };
  },
};

/**
 * Helper function to build deep link URLs
 * Useful for generating share links, email links, etc.
 */
export const buildDeepLink = (screen: string, params?: Record<string, string | number>): string => {
  const baseUrl = 'foodwaste://';
  let url = baseUrl + screen;

  if (params) {
    const paramString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    if (paramString) {
      url += `?${paramString}`;
    }
  }

  return url;
};

/**
 * Helper function to build universal links (for sharing)
 * These work on web and deep link to app if installed
 */
export const buildUniversalLink = (
  screen: string,
  params?: Record<string, string | number>,
): string => {
  const baseUrl = 'https://foodwasteapp.com/';
  let url = baseUrl + screen;

  if (params) {
    const paramString = Object.entries(params)
      .map(([key, value]) => `${key}/${value}`)
      .join('/');

    if (paramString) {
      url += `/${paramString}`;
    }
  }

  return url;
};

/**
 * Example deep link URLs:
 *
 * // Auth Stack - Custom URL Scheme (foodwaste://)
 * foodwaste://auth/login
 * foodwaste://auth/register
 * foodwaste://auth/forgot-password
 * foodwaste://auth/reset-password?token=abc123&email=user@example.com
 * foodwaste://auth/verify-email?email=user@example.com
 * foodwaste://auth/mfa-verification
 *
 * // Auth Stack - Universal Links (https://foodwasteapp.com)
 * https://foodwasteapp.com/auth/login
 * https://foodwasteapp.com/auth/reset-password?token=abc123&email=user@example.com
 * https://foodwasteapp.com/auth/verify-email?email=user@example.com
 *
 * // Main Stack - Custom URL Scheme
 * foodwaste://app/home
 * foodwaste://app/search
 * foodwaste://app/offer/123
 * foodwaste://app/establishment/456
 * foodwaste://app/order/789
 *
 * // Main Stack - Universal Links
 * https://foodwasteapp.com/app/home
 * https://foodwasteapp.com/app/offer/123
 * https://foodwasteapp.com/app/establishment/456
 */
