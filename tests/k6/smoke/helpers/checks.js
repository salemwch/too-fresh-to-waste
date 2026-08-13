import { check } from 'k6';

// Validates standard backend response envelope: { status, message, data, meta? }
export function checkResponse(res, name, expectedStatus = 200) {
  return check(res, {
    [`${name} — status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} — is JSON`]: (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    [`${name} — envelope success`]: (r) => {
      try {
        return JSON.parse(r.body).status === 'success';
      } catch {
        return false;
      }
    },
  });
}

// Validates paginated list responses with meta
export function checkPaginatedResponse(res, name) {
  const basic = checkResponse(res, name);
  const paged = check(res, {
    [`${name} — has data array`]: (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
    [`${name} — has meta`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.meta && typeof body.meta.total === 'number';
      } catch {
        return false;
      }
    },
  });
  return basic && paged;
}

// Validates that an endpoint correctly rejects unauthenticated requests
export function checkRequiresAuth(res, name) {
  return check(res, {
    [`${name} — rejects unauthenticated (401)`]: (r) => r.status === 401,
  });
}

// Validates error responses have correct shape
export function checkErrorResponse(res, name, expectedStatus) {
  return check(res, {
    [`${name} — status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} — error envelope`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'error' && typeof body.message === 'string';
      } catch {
        return false;
      }
    },
  });
}

// Extract data from standard response envelope
export function extractData(res) {
  try {
    return JSON.parse(res.body).data;
  } catch {
    return null;
  }
}

export function extractMeta(res) {
  try {
    return JSON.parse(res.body).meta;
  } catch {
    return null;
  }
}

/**
 * The document id under whichever name this endpoint uses.
 *
 * List endpoints serve trimmed DTOs (`OfferCardDto` has `id` and no `_id`)
 * while detail endpoints serve the document (both). Reading `_id` off a list
 * row therefore yields undefined, and since every caller here is shaped
 * `if (items.length > 0) { const id = items[0]._id; ... }`, the detail request
 * is skipped without a single failing check. Mirrors `docId` in
 * `tests/k6/lib/envelope.js` — the two helper modules are deliberately
 * separate (smoke vs. load), so this exists in both.
 */
export function docId(doc) {
  if (doc === null || doc === undefined) {
    return null;
  }
  return doc.id ?? doc._id ?? null;
}
