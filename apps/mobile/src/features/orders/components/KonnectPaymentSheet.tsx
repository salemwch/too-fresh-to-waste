import React, { useEffect } from 'react';
import { Linking } from 'react-native';

import { Logger } from '@/utils/logger';

interface KonnectPaymentSheetProps {
  visible: boolean;
  payUrl: string;
  /**
   * Called after the Konnect checkout URL was successfully handed off to the
   * browser. Completion itself is detected later by OrderDetailsScreen polling
   * the backend for the webhook-driven status change — it is NOT known here.
   */
  onDismiss: () => void;
  /** Called when the checkout URL could not be opened at all. */
  onPaymentFailed: () => void;
}

/**
 * Konnect uses a hosted checkout page. We hand the URL off to the system
 * browser and let the backend webhook drive the order status; the user returns
 * to the app and OrderDetailsScreen polls until payment is confirmed.
 *
 * Success (URL opened) and failure (URL could not open) are mutually exclusive:
 * we only dismiss once the browser has actually opened, so a launch failure
 * surfaces to the user instead of being swallowed by an immediate navigation.
 */
export const KonnectPaymentSheet: React.FC<KonnectPaymentSheetProps> = ({
  visible,
  payUrl,
  onDismiss,
  onPaymentFailed,
}) => {
  useEffect(() => {
    if (!visible || !payUrl) return;

    let cancelled = false;

    void (async () => {
      try {
        await Linking.openURL(payUrl);
        if (!cancelled) onDismiss();
      } catch (err) {
        Logger.error('[KonnectPaymentSheet] Failed to open payment URL', {}, err as Error);
        if (!cancelled) onPaymentFailed();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, payUrl, onDismiss, onPaymentFailed]);

  return null;
};
