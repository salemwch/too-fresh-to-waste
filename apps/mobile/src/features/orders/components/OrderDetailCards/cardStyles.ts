/**
 * Shared card chrome for the order-detail sections.
 *
 * The four cards had identical padding, section-title and divider styles inside
 * the screen's single StyleSheet. Extracting them per-component would have made
 * four copies — which is how the search mappers drifted — so the common shell
 * lives here and each component keeps only what is its own.
 */

import { StyleSheet } from 'react-native';

/** Hairline between rows and sections. */
export const DIVIDER_COLOR = '#e5e7eb';

export const cardStyles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
    marginVertical: 8,
  },
});
