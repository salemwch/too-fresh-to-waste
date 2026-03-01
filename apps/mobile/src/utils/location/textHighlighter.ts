/**
 * Text Highlighter Utility
 *
 * Provides functions to highlight matched substrings in search results.
 * Used for bolding matched text in location search autocomplete.
 *
 * @module TextHighlighter
 */

/**
 * Highlight match in text
 *
 * Returns an object with parts of the text split into highlighted and non-highlighted sections.
 *
 * @param text - Full text to highlight
 * @param query - Search query to highlight
 * @returns Object with highlighted and non-highlighted parts
 *
 * @example
 * ```tsx
 * const parts = highlightMatch("Ariana", "Ari");
 * // Returns: [{ text: "Ari", highlight: true }, { text: "ana", highlight: false }]
 * ```
 */
export function highlightMatch(
  text: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  if (!query || !text) {
    return [{ text, highlight: false }];
  }

  // Normalize for case-insensitive search
  const normalizeText = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);

  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return [{ text, highlight: false }];
  }

  const beforeMatch = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const afterMatch = text.substring(index + query.length);

  return [
    ...(beforeMatch ? [{ text: beforeMatch, highlight: false }] : []),
    { text: match, highlight: true },
    ...(afterMatch ? [{ text: afterMatch, highlight: false }] : []),
  ];
}
