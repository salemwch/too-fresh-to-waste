/**
 * Module-level navigation ref
 * Enables navigation from outside React components (notifications, links).
 * Pattern: https://reactnavigation.org/docs/navigating-without-navigation-prop/
 */
import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

import { Logger } from '@/utils/logger';

import type { RootNavigatorParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootNavigatorParamList>();

// ─── Notification payload from FCM data field ──────────────────────────────
export interface NotificationNavData {
  trigger?: string;
  orderId?: string;
  offerId?: string;
  establishmentId?: string;
}

/**
 * Wrapper for navigationRef.dispatch(CommonActions.reset(...)).
 * The exactOptionalPropertyTypes flag causes a spurious mismatch between
 * ResetState | undefined and the dispatch overload — casting to unknown here
 * is intentional and safe; the action is well-formed at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resetTo(routes: any[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigationRef.dispatch(CommonActions.reset({ index: 0, routes }) as any);
}

/**
 * Navigate based on an FCM notification payload.
 * Called on background-tap (onNotificationOpenedApp) and
 * killed-state-tap (getInitialNotification).
 */
export function navigateFromNotification(data: NotificationNavData): void {
  if (!navigationRef.isReady()) {
    Logger.warn('[navigationRef] Nav not ready — skipping notification navigation');
    return;
  }

  const { trigger, orderId, offerId } = data;
  Logger.debug('[navigationRef] Navigating from notification', { trigger, orderId, offerId });

  // Order-related triggers → OrderDetails (nested inside Orders tab)
  if (
    (trigger === 'order_confirmed' ||
      trigger === 'pickup_ready' ||
      trigger === 'pickup_reminder_2h' ||
      trigger === 'pickup_reminder_24h') &&
    orderId
  ) {
    resetTo([
      {
        name: 'MainStack',
        state: {
          routes: [
            {
              name: 'MainTabs',
              state: {
                // Tab order: Home(0), Search(1), Favorites(2), Orders(3), Profile(4)
                index: 3,
                routes: [
                  { name: 'Home' },
                  { name: 'Search' },
                  { name: 'Favorites' },
                  {
                    name: 'Orders',
                    state: {
                      index: 1,
                      routes: [
                        { name: 'OrdersList' },
                        { name: 'OrderDetails', params: { orderId } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
    return;
  }

  // Order cancelled → OrdersList
  if (trigger === 'order_cancelled') {
    resetTo([
      {
        name: 'MainStack',
        state: {
          routes: [
            {
              name: 'MainTabs',
              state: {
                index: 3,
                routes: [
                  { name: 'Home' },
                  { name: 'Search' },
                  { name: 'Favorites' },
                  {
                    name: 'Orders',
                    state: { index: 0, routes: [{ name: 'OrdersList' }] },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
    return;
  }

  // New offer nearby → OfferDetails if offerId present
  if (trigger === 'new_offer_nearby' && offerId) {
    resetTo([
      {
        name: 'MainStack',
        state: {
          routes: [{ name: 'MainTabs' }, { name: 'OfferDetails', params: { offerId } }],
        },
      },
    ]);
    return;
  }

  // Fallback → MainStack root (home tab)
  resetTo([{ name: 'MainStack' }]);
}
