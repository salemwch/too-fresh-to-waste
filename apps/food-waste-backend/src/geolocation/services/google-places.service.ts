import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Google Places API (New) Service
 *
 * Provides secure, server-side access to Google Places API (New).
 * Migrated from legacy Maps API to places.googleapis.com/v1/.
 *
 * Features:
 * - Tunisia-restricted searches (includedRegionCodes: ["tn"])
 * - Session token support for cost optimization
 * - X-Goog-FieldMask: Essentials-only fields for cost control (10,000 free/month)
 * - Request timeout and error handling
 * - Response normalization to internal format
 *
 * Cost Strategy (Places API New — Essentials SKU):
 * - Autocomplete: FREE with session tokens
 * - Place Details: Essentials SKU (id, location, formattedAddress, addressComponents)
 *   → 10,000 free/month, then $5/1,000
 * - displayName & types are Pro SKU ($17/1,000, only 5,000 free)
 *   → We get name & types from the FREE autocomplete response instead
 *
 * References:
 * - Autocomplete (New): https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 * - Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
 * - Field Masks: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing#field-masks
 * - Session Tokens: https://developers.google.com/maps/documentation/places/web-service/session-tokens
 */

// ============================================================================
// Interfaces: Places API (New) Response Structures
// ============================================================================

/** Autocomplete suggestion from Places API (New) */
interface PlacePrediction {
  place: string; // Resource name e.g. "places/ChIJ..."
  placeId: string;
  text: {
    text: string;
    matches?: Array<{ startOffset?: number; endOffset: number }>;
  };
  structuredFormat: {
    mainText: {
      text: string;
      matches?: Array<{ startOffset?: number; endOffset: number }>;
    };
    secondaryText?: {
      text: string;
    };
  };
  types?: string[];
}

/** Autocomplete response from Places API (New) */
interface AutocompleteResponse {
  suggestions: Array<{
    placePrediction: PlacePrediction;
  }>;
}

/** Address component from Places API (New) */
interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode?: string;
}

/**
 * Place Details response from Places API (New) — Essentials fields only.
 * displayName and types are NOT requested (Pro SKU).
 */
interface PlaceDetailsResponse {
  id: string;
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: AddressComponent[];
}

// ============================================================================
// Normalized Output Interfaces (public contract - unchanged)
// ============================================================================

/** Normalized location result with coordinates */
export interface GoogleLocationResult {
  id: string;
  name: string;
  nameAr: string;
  subtext: string;
  coords: {
    lat: number;
    lng: number;
  };
  source: 'GOOGLE';
  formattedAddress: string;
  googlePlaceId: string;
  addressComponents?:
    | {
        street?: string | undefined;
        city?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
      }
    | undefined;
  types?: string[] | undefined;
}

/** Autocomplete suggestion (no coordinates - used for session token flow) */
export interface GoogleAutocompleteSuggestion {
  id: string;
  name: string;
  nameAr: string;
  subtext: string;
  source: 'GOOGLE';
  googlePlaceId: string;
  types?: string[] | undefined;
}

/**
 * Field mask for Place Details — Essentials SKU only.
 * 10,000 free requests/month, then $5/1,000.
 *
 * Excluded (Pro SKU — $17/1,000, only 5,000 free):
 * - displayName → captured from autocomplete response instead
 * - types → captured from autocomplete response instead
 *
 * @see https://developers.google.com/maps/billing-and-pricing/pricing
 */
const PLACE_DETAILS_FIELD_MASK = 'id,formattedAddress,location,addressComponents';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxResults: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GOOGLE_PLACES_API_KEY');
    this.timeout = this.configService.get<number>('GOOGLE_PLACES_TIMEOUT', 10000);
    this.maxResults = this.configService.get<number>('GOOGLE_PLACES_MAX_RESULTS', 5);

    if (!this.apiKey || this.apiKey === 'your_google_places_api_key_here') {
      this.logger.error('GOOGLE_PLACES_API_KEY is not configured properly');
      throw new Error('Google Places API key not configured');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://places.googleapis.com/v1',
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
      },
    });

    this.logger.log('GooglePlacesService initialized (Places API New)');
  }

  /**
   * Get autocomplete suggestions WITHOUT coordinates.
   * Cost-optimized: FREE when used with a session token.
   *
   * @param query - Search query (e.g., "Cafe Tunis")
   * @param sessionToken - UUID session token for billing optimization
   * @param limit - Maximum results to return
   */
  async autocomplete(
    query: string,
    sessionToken?: string,
    limit?: number,
  ): Promise<GoogleAutocompleteSuggestion[]> {
    try {
      this.logger.debug(`Autocomplete: "${query}" (session: ${sessionToken ? 'yes' : 'no'})`);

      if (!query || query.trim().length < 2) {
        return [];
      }

      const predictions = await this.fetchAutocompletePredictions(query, sessionToken, limit);

      const suggestions = predictions.map((p) => this.normalizePredictionToSuggestion(p));

      this.logger.log(`Autocomplete completed: "${query}" - ${suggestions.length} suggestions`);
      return suggestions;
    } catch (error) {
      this.handleError(error, 'autocomplete');
      return [];
    }
  }

  /**
   * Get full place details by Google Place ID.
   * Concludes the session token session.
   *
   * Uses X-Goog-FieldMask for cost control (Location SKU).
   *
   * @param placeId - Google Place ID (e.g., "ChIJZa7pLMDy4RIRkHFwgn4ruUc")
   * @param sessionToken - Same session token used in autocomplete (concludes session)
   */
  async getPlaceDetailsById(
    placeId: string,
    sessionToken?: string,
  ): Promise<GoogleLocationResult | null> {
    try {
      this.logger.debug(`Place Details: ${placeId} (session: ${sessionToken ? 'yes' : 'no'})`);

      if (!placeId) {
        this.logger.warn('getPlaceDetailsById called without placeId');
        return null;
      }

      const details = await this.fetchPlaceDetails(placeId, sessionToken);

      if (!details) {
        return null;
      }

      const result = this.normalizeDetailsToLocationResult(details);

      this.logger.log(`Place Details completed: ${placeId} -> ${result.formattedAddress}`);
      return result;
    } catch (error) {
      this.handleError(error, 'getPlaceDetailsById');
      return null;
    }
  }

  // ============================================================================
  // Private: Google API Calls (Places API New)
  // ============================================================================

  /**
   * POST /places:autocomplete
   * No X-Goog-FieldMask needed (autocomplete doesn't support it)
   */
  private async fetchAutocompletePredictions(
    query: string,
    sessionToken?: string,
    limit?: number,
  ): Promise<PlacePrediction[]> {
    try {
      const body: Record<string, unknown> = {
        input: query,
        includedRegionCodes: ['tn'],
        languageCode: 'fr',
      };

      if (sessionToken) {
        body['sessionToken'] = sessionToken;
      }

      const response = await this.axiosInstance.post<AutocompleteResponse>(
        '/places:autocomplete',
        body,
      );

      const suggestions = response.data.suggestions ?? [];
      const predictions = suggestions
        .filter(
          (
            s,
          ): s is typeof s & {
            placePrediction: NonNullable<(typeof s)['placePrediction']>;
          } => s.placePrediction !== null && s.placePrediction !== undefined,
        )
        .map((s) => s.placePrediction);

      return predictions.slice(0, limit ?? this.maxResults);
    } catch (error) {
      this.handleError(error, 'fetchAutocompletePredictions');
      return [];
    }
  }

  /**
   * GET /places/{placeId}
   * Uses X-Goog-FieldMask for cost control (Location SKU)
   */
  private async fetchPlaceDetails(
    placeId: string,
    sessionToken?: string,
  ): Promise<PlaceDetailsResponse | null> {
    try {
      const params: Record<string, string> = {
        languageCode: 'fr',
      };

      if (sessionToken) {
        params['sessionToken'] = sessionToken;
      }

      const response = await this.axiosInstance.get<PlaceDetailsResponse>(`/places/${placeId}`, {
        params,
        headers: {
          'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch place details for ${placeId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // Private: Normalization (New API format)
  // ============================================================================

  /**
   * Normalize a PlacePrediction to a suggestion (no coordinates).
   * Includes types from autocomplete (free) so frontend doesn't need Pro SKU.
   */
  private normalizePredictionToSuggestion(
    prediction: PlacePrediction,
  ): GoogleAutocompleteSuggestion {
    const mainText = prediction.structuredFormat.mainText.text;
    const secondaryText = prediction.structuredFormat.secondaryText?.text ?? 'Tunisia';

    return {
      id: `GOOGLE_${prediction.placeId}`,
      name: mainText,
      nameAr: mainText,
      subtext: secondaryText,
      source: 'GOOGLE',
      googlePlaceId: prediction.placeId,
      types: prediction.types,
    };
  }

  /**
   * Normalize PlaceDetailsResponse to GoogleLocationResult.
   *
   * name and types are NOT available here (Essentials SKU).
   * The frontend merges them from the autocomplete response.
   */
  private normalizeDetailsToLocationResult(details: PlaceDetailsResponse): GoogleLocationResult {
    const addressComponents = this.parseAddressComponents(details.addressComponents);

    const governorate = details.addressComponents?.find((c) =>
      c.types.includes('administrative_area_level_1'),
    );

    const subtext = governorate ? `${governorate.longText}, Tunisia` : 'Tunisia';

    return {
      id: `GOOGLE_${details.id}`,
      name: '',
      nameAr: '',
      subtext,
      coords: {
        lat: details.location.latitude,
        lng: details.location.longitude,
      },
      source: 'GOOGLE',
      formattedAddress: details.formattedAddress,
      googlePlaceId: details.id,
      addressComponents,
    };
  }

  /** Parse address components from the new API format */
  private parseAddressComponents(
    components?: AddressComponent[],
  ): GoogleLocationResult['addressComponents'] {
    if (!components || components.length === 0) {
      return undefined;
    }

    const findByType = (type: string): string | undefined =>
      components.find((c) => c.types.includes(type))?.longText;

    return {
      street: findByType('route') ?? findByType('street_address'),
      city: findByType('locality') ?? findByType('administrative_area_level_2'),
      postalCode: findByType('postal_code'),
      country: findByType('country') ?? 'Tunisia',
    };
  }

  /** Handle and log errors from Google Places API */
  private handleError(error: unknown, context: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const errorDetails = axiosError.response?.data ?? axiosError.message;
      this.logger.error(`Google Places API error in ${context}:`, errorDetails);

      if (axiosError.response?.status === 403) {
        throw new HttpException(
          'Google Places API key is invalid or has insufficient permissions',
          HttpStatus.BAD_GATEWAY,
        );
      }
    } else {
      this.logger.error(`Error in ${context}:`, error);
    }
  }
}
