import { check } from 'k6';

import { TUNIS } from '../config/environments.js';
import { withAuth } from '../lib/auth.js';
import { checkOk } from '../lib/envelope.js';
import { get, post } from '../lib/http.js';

/**
 * Driver polling: a geo query plus a location write, on a fixed cadence.
 *
 * This is the one journey that must run under an *open* model
 * (constant-arrival-rate). A driver's app posts its position on a timer and
 * does not slow down because the server did — modelling it closed would reduce
 * offered load precisely when the geo query starts to struggle, which is the
 * moment the test exists to observe.
 */
export function driverPoll(session) {
  const jitter = () => (Math.random() - 0.5) * 0.02;
  const lat = TUNIS.latitude + jitter();
  const lng = TUNIS.longitude + jitter();

  const available = withAuth(session, params =>
    get(`/drivers/orders/available?lat=${lat}&lng=${lng}`, 'driver_available', params),
  );
  checkOk(available, 'driver available orders');

  const located = withAuth(session, params =>
    post(
      '/drivers/location',
      { lat, lng },
      'driver_location',
      params,
    ),
  );
  check(located, {
    'driver: location accepted': r => r.status === 200 || r.status === 201 || r.status === 204,
  });
}
