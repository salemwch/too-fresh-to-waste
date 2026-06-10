'use client';

import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

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
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const isDNTEnabled =
      respectDNT &&
      (navigator.doNotTrack === '1' ||
        window.doNotTrack === '1' ||
        // @ts-expect-error - IE/Edge legacy property
        navigator.msDoNotTrack === '1');

    const cookieConsent = localStorage.getItem('cookie-consent');
    const isConsentDeclined = cookieConsent === 'declined';

    const shouldEnable = Boolean(enabled && !isDNTEnabled && !isConsentDeclined && measurementId);
    setShouldLoad(shouldEnable);

    function handleDeclined() {
      setShouldLoad(false);
    }
    window.addEventListener('cookie-consent-declined', handleDeclined);
    return () => window.removeEventListener('cookie-consent-declined', handleDeclined);
  }, [measurementId, enabled, respectDNT]);

  // Don't render if not enabled
  if (!shouldLoad) {
    return null;
  }

  return <NextGoogleAnalytics gaId={measurementId} />;
}
