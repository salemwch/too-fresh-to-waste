/**
 * String utility helpers
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;':  '&',
  '&lt;':   '<',
  '&gt;':   '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#39;':  "'",
};

/**
 * Decode common HTML entities in a string.
 * Runs iteratively until the string is stable, handling double/triple
 * encoding (e.g. &amp;amp; → &amp; → &).
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  const pattern = /&(?:amp|lt|gt|quot|apos|#x27|#x2F|#39);/g;
  let result = str;
  let prev = '';
  // Iterate until stable (handles &amp;amp;amp; etc.)
  while (prev !== result) {
    prev = result;
    result = result.replace(pattern, match => HTML_ENTITIES[match] ?? match);
  }
  return result;
}

/**
 * Recursively decode HTML entities in all string values of an object/array.
 * Used by the API client response interceptor.
 */
export function decodeEntitiesDeep(value: unknown): unknown {
  if (typeof value === 'string') return decodeHtmlEntities(value);
  if (Array.isArray(value)) return value.map(decodeEntitiesDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decodeEntitiesDeep(v);
    }
    return out;
  }
  return value;
}
