/**
 * Location Utilities Barrel Export
 *
 * Centralizes exports for location-related utilities.
 */

export { LocationAdapter } from './locationAdapter';
export {
  transformLocationResultsToItems,
  transformLocationResultToItem,
  extractCoordinatesFromLocationItem,
  getLocationDisplayName,
  getLocationFullAddress,
} from './locationTransformers';
export { highlightMatch } from './textHighlighter';
