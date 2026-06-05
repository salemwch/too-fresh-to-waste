/**
 * Decode common HTML entities to plain-text equivalents.
 * Used defensively on DB output to handle data stored before
 * the sanitization middleware's decode-on-write fix.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str.includes('&')) {
    return str;
  }
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}
