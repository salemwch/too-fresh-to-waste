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
}: GoogleAnalyticsProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Check if analytics should be loaded
    const isDNTEnabled = respectDNT && (
      navigator.doNotTrack === '1' ||
      // @ts-expect-error - some browsers use window.doNotTrack
      window.doNotTrack === '1' ||
      // @ts-expect-error - IE/Edge legacy property
      navigator.msDoNotTrack === '1'
    );

    const shouldEnable = Boolean(enabled && !isDNTEnabled && measurementId);

    setShouldLoad(shouldEnable);

    // Log status in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[GoogleAnalytics] Configuration:', {
        measurementId,
        enabled,
        isDNTEnabled,
        willLoad: shouldEnable,
      });
    }
  }, [measurementId, enabled, respectDNT]);

  // Don't render if not enabled
  if (!shouldLoad) {
    return null;
  }

  return <NextGoogleAnalytics gaId={measurementId} />;
}
