'use client';

import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google';
import { useSyncExternalStore } from 'react';

/*
 * Consent and Do Not Track live in the browser, not in React: one in
 * localStorage plus a `cookie-consent-declined` event, the other on
 * `navigator`. Reading them through useSyncExternalStore rather than copying
 * them into state with an effect means the decision is derived, not stored -
 * so it cannot drift, and there is no mount render that says "load analytics"
 * before the effect corrects it.
 *
 * Both take a server snapshot of `false`: nothing loads during SSR, and the
 * real values are read on the client without a hydration mismatch.
 */

const CONSENT_DECLINED_EVENT = 'cookie-consent-declined';

function subscribeToConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_DECLINED_EVENT, onChange);
  // Another tab writing the cookie decision should count too.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CONSENT_DECLINED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const getConsentDeclined = (): boolean => localStorage.getItem('cookie-consent') === 'declined';

/** DNT is fixed for the life of the document, so there is nothing to subscribe to. */
const subscribeToDnt = (): (() => void) => () => {};

const getDntEnabled = (): boolean =>
  navigator.doNotTrack === '1' ||
  window.doNotTrack === '1' ||
  // @ts-expect-error - IE/Edge legacy property
  navigator.msDoNotTrack === '1';

const noOnServer = (): boolean => false;

interface GoogleAnalyticsProps {
  measurementId: string;
  /** Whether to respect Do Not Track browser settings. Default: true */
  respectDNT?: boolean;
  /** Whether analytics is enabled. Can be controlled via feature flag. Default: true */
  enabled?: boolean;
}

/**
 * Google Analytics 4 component with privacy controls
 *
 * Features:
 * - Respects Do Not Track (DNT) browser setting
 * - Can be disabled via environment variable or feature flag
 * - Uses official @next/third-parties/google implementation
 * - Only loads in production or when explicitly enabled
 *
 * @example
 * ```tsx
 * <GoogleAnalytics measurementId="G-XXXXXXXXXX" />
 * ```
 */
export function GoogleAnalytics({
  measurementId,
  respectDNT = true,
  enabled = true,
}: Readonly<GoogleAnalyticsProps>) {
  const consentDeclined = useSyncExternalStore(subscribeToConsent, getConsentDeclined, noOnServer);
  const dntEnabled = useSyncExternalStore(subscribeToDnt, getDntEnabled, noOnServer);

  // Derived, not stored: there is no state that can disagree with the browser.
  const shouldLoad = Boolean(
    enabled && measurementId && !consentDeclined && !(respectDNT && dntEnabled),
  );

  // Don't render if not enabled
  if (!shouldLoad) {
    return null;
  }

  return <NextGoogleAnalytics gaId={measurementId} />;
}
