import { check } from 'k6';

// Every backend endpoint answers with { status, message, data, meta? }.
// Parsing is done once per response and passed around, because JSON.parse
// inside three separate check predicates is three parses of the same body on
// the hot path of every iteration.

export function parse(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

export function data(res) {
  const body = parse(res);
  return body ? body.data : null;
}

export function meta(res) {
  const body = parse(res);
  return body ? body.meta : null;
}

/**
 * The envelope's `status` is the HTTP status as a **number** (200), not the
 * string 'success'. Verified against /auth/login and /offers:
 *
 *   { status: 200, message: 'Login successful', data: {...}, meta?, timestamp }
 *
 * Both forms are accepted because the string variant is what the project docs
 * describe, so some endpoint may still use it; treating only one as valid would
 * make this either fail everywhere or quietly stop checking anything.
 */
function isSuccessEnvelope(body) {
  if (body === null || body === undefined) {
    return false;
  }
  if (typeof body.status === 'number') {
    return body.status >= 200 && body.status < 400;
  }
  return body.status === 'success';
}

export function checkOk(res, name, expectedStatus = 200) {
  const body = parse(res);
  return check(res, {
    [`${name}: status ${expectedStatus}`]: r => r.status === expectedStatus,
    [`${name}: success envelope`]: () => isSuccessEnvelope(body),
  });
}

export function checkList(res, name) {
  const body = parse(res);
  return check(res, {
    [`${name}: status 200`]: r => r.status === 200,
    [`${name}: data is array`]: () => body !== null && Array.isArray(body.data),
    // meta sits on the envelope alongside data, never inside it — a regression
    // here breaks pagination on every client at once.
    [`${name}: meta.total present`]: () =>
      body !== null && body.meta !== undefined && typeof body.meta.total === 'number',
  });
}

/**
 * The document id, whichever name this endpoint uses for it.
 *
 * List endpoints serve trimmed DTOs and detail endpoints serve the Mongoose
 * document, and the two do not agree: `GET /offers` returns `OfferCardDto`
 * with `id` and no `_id`, while `GET /offers/:id` returns both. Reading `_id`
 * off a card therefore yields undefined, and because every journey guards with
 * `if (!offer._id) return;` the iteration ends in silence and the suite still
 * reports green.
 *
 * That is not hypothetical: the checkout journey had never created a single
 * order, and no run said so — `order_create` simply had zero samples.
 */
export function docId(doc) {
  if (doc === null || doc === undefined) {
    return null;
  }
  return doc.id ?? doc._id ?? null;
}

/** Picks a random element, or null for an empty/absent list. */
export function sample(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[Math.floor(Math.random() * list.length)];
}
