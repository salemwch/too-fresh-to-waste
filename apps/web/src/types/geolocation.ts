/**
 * Autocomplete suggestion from backend (no coordinates).
 * Includes name and types — these are FREE from autocomplete.
 * Place Details (Essentials SKU) does NOT return them.
 */
export interface PlaceSuggestion {
  id: string;
  name: string;
  nameAr: string;
  subtext: string;
  source: 'GOOGLE';
  googlePlaceId: string;
  types?: string[];
}

/**
 * Full place details with coordinates.
 * name and types come from the autocomplete suggestion (free),
 * NOT from Place Details (would cost Pro SKU).
 * The frontend merges them in BusinessSearchAutocomplete.
 */
export interface PlaceDetails {
  id: string;
  name: string;
  nameAr: string;
  subtext: string;
  formattedAddress: string;
  coords: {
    lat: number;
    lng: number;
  };
  source: 'GOOGLE';
  googlePlaceId: string;
  addressComponents?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  types?: string[];
}
