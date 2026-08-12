import { check } from 'k6';

import { TUNIS } from '../config/environments.js';
import { authParams } from '../lib/auth.js';
import { batch } from '../lib/http.js';

/**
 * The mobile app-open burst.
 *
 * Four requests fired in parallel with no think-time, then the iteration ends.
 * This is the worst-shaped traffic the API receives and the one a Play Store
 * release produces from thousands of devices at once, so it is modelled as a
 * batch: issuing the same four serially would understate peak concurrency by
 * 4x and quietly make the results look better than production.
 */
export function consumerColdStart(session) {
  const params = authParams(session);

  const [me, nearby, unread, favouriteIds] = batch([
    { path: '/auth/me', name: 'auth_me', params },
    {
      path: `/offers/nearby?latitude=${TUNIS.latitude}&longitude=${TUNIS.longitude}&radius=5000&limit=10`,
      name: 'offers_nearby',
      params,
    },
    { path: '/notifications/unread/count', name: 'notifications_unread', params },
    { path: '/favorites/ids', name: 'favorites_ids', params },
  ]);

  check(me, { 'cold start: session valid': r => r.status === 200 });
  check(nearby, { 'cold start: nearby offers returned': r => r.status === 200 });
  check(unread, { 'cold start: unread count returned': r => r.status === 200 });
  check(favouriteIds, { 'cold start: favourite ids returned': r => r.status === 200 });
}
