import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  GeocodingResult,
  ReverseGeocodingResult,
  AddressInfo,
  GeocodingAccuracy,
} from '../interfaces/geolocation.interface';

/**
 * Geoapify Geocoding Service
 *
 * Provides reverse geocoding (coordinates -> address) and forward geocoding (address -> coordinates)
 * via the Geoapify API (free tier: 3,000 requests/day).
 *
 * References:
 * - Reverse Geocoding: https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/
 * - Forward Geocoding: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
 * - Free tier limits:  https://www.geoapify.com/pricing
 */

/** Single feature from Geoapify FeatureCollection response */
interface GeoapifyFeatureProperties {
  country: string;
  country_code: string;
  state?: string;
  county?: string;
  city?: string;
  district?: string;
  suburb?: string;
  name?: string;
  postcode?: string;
  street?: string;
  housenumber?: string;
  formatted: string;
  lat: number;
  lon: number;
  result_type?: string;
  rank?: {
    importance?: number;
    confidence?: number;
    confidence_city_level?: number;
    match_type?: string;
  };
}

interface GeoapifyFeature {
  type: 'Feature';
  properties: GeoapifyFeatureProperties;
}

interface GeoapifyResponse {
  type: 'FeatureCollection';
  features: GeoapifyFeature[];
}

@Injectable()
export class GeoapifyService {
  private readonly logger = new Logger(GeoapifyService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GEOAPIFY_API_KEY');
    const timeout = this.configService.get<number>('GEOAPIFY_TIMEOUT', 10000);

    if (!this.apiKey || this.apiKey === 'your_geoapify_api_key_here') {
      this.logger.error('GEOAPIFY_API_KEY is not configured properly');
      throw new Error('Geoapify API key not configured');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://api.geoapify.com/v1/geocode',
      timeout,
    });

    this.logger.log('GeoapifyService initialized');
  }

  /**
   * Reverse geocode coordinates to address.
   *
   * @param lat - Latitude (-90 to 90)
   * @param lng - Longitude (-180 to 180)
   * @param language - Response language (default: 'en')
   * @returns ReverseGeocodingResult with primaryAddress and addresses array
   */
  async reverseGeocode(
    lat: number,
    lng: number,
    language: string = 'en',
  ): Promise<ReverseGeocodingResult> {
    try {
      this.logger.debug(`Reverse geocode: lat=${lat}, lng=${lng}, lang=${language}`);

      const response = await this.axiosInstance.get<GeoapifyResponse>('/reverse', {
        params: {
          lat,
          lon: lng,
          lang: language,
          apiKey: this.apiKey,
        },
      });

      const features = response.data?.features ?? [];

      if (features.length === 0) {
        this.logger.warn(`No results for reverse geocode: lat=${lat}, lng=${lng}`);
        return {
          coordinates: { latitude: lat, longitude: lng },
          addresses: [],
          primaryAddress: {
            city: '',
            postalCode: '',
            country: '',
            formattedAddress: '',
          },
        };
      }

      // Log raw Geoapify fields for debugging locality resolution
      const primary = features[0].properties;
      this.logger.debug(
        `Geoapify raw fields: name=${primary.name}, suburb=${primary.suburb}, ` +
        `district=${primary.district}, city=${primary.city}, county=${primary.county}, ` +
        `state=${primary.state}, result_type=${primary.result_type}, ` +
        `formatted=${primary.formatted}`,
      );

      const addresses = features.map((f) => this.mapPropertiesToAddress(f.properties));
      const primaryAddress = addresses[0];

      this.logger.log(
        `Reverse geocode completed: ${primaryAddress.city}, ${primaryAddress.country}`,
      );

      return {
        coordinates: { latitude: lat, longitude: lng },
        addresses,
        primaryAddress,
      };
    } catch (error) {
      this.handleError(error, 'reverseGeocode');
      throw new HttpException(
        'Reverse geocoding failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Forward geocode (address -> coordinates).
   *
   * @param address - Free-text address to geocode
   * @param language - Response language (default: 'en')
   * @param limit - Max results (default: 1, max: 10)
   * @param countryCode - ISO 3166-1 alpha-2 country filter (e.g., 'tn')
   * @returns Array of GeocodingResult
   */
  async geocodeAddress(
    address: string,
    language: string = 'en',
    limit: number = 1,
    countryCode?: string,
  ): Promise<GeocodingResult[]> {
    try {
      this.logger.debug(`Geocode address: "${address}", lang=${language}, limit=${limit}`);

      const params: Record<string, string | number> = {
        text: address,
        lang: language,
        limit,
        apiKey: this.apiKey,
      };

      if (countryCode) {
        params.filter = `countrycode:${countryCode.toLowerCase()}`;
      }

      const response = await this.axiosInstance.get<GeoapifyResponse>('/search', {
        params,
      });

      const features = response.data?.features ?? [];

      if (features.length === 0) {
        this.logger.warn(`No results for geocode: "${address}"`);
        return [];
      }

      const results = features.map((f) => this.mapFeatureToGeocodingResult(f));

      this.logger.log(`Geocode completed: "${address}" - ${results.length} result(s)`);
      return results;
    } catch (error) {
      this.handleError(error, 'geocodeAddress');
      throw new HttpException(
        'Forward geocoding failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================================================
  // Private: Response Mapping
  // ============================================================================

  private mapPropertiesToAddress(props: GeoapifyFeatureProperties): AddressInfo {
    const street = props.housenumber
      ? `${props.housenumber}, ${props.street ?? ''}`
      : props.street ?? '';

    // Prefer the most granular locality available.
    // Geoapify hierarchy: name → suburb → district → city → county → state
    // For small towns (e.g. Messadine within M'saken delegation, Sousse governorate):
    //   name="Messadine", district="Msaken", city="Sousse", state="Sousse"
    // Without this chain, users see the broad administrative region instead of their locality.
    const city =
      props.suburb || props.name || props.district || props.city || props.county || props.state || '';

    return {
      street: street || undefined,
      city,
      postalCode: props.postcode || '',
      country: props.country || '',
      formattedAddress: props.formatted || '',
    };
  }

  private mapFeatureToGeocodingResult(feature: GeoapifyFeature): GeocodingResult {
    const props = feature.properties;

    return {
      coordinates: {
        latitude: props.lat,
        longitude: props.lon,
      },
      address: this.mapPropertiesToAddress(props),
      accuracy: this.mapMatchTypeToAccuracy(props.rank?.match_type),
      provider: 'geoapify',
    };
  }

  private mapMatchTypeToAccuracy(matchType?: string): GeocodingAccuracy {
    switch (matchType) {
      case 'full_match':
        return GeocodingAccuracy.ROOFTOP;
      case 'inner_part':
        return GeocodingAccuracy.RANGE_INTERPOLATED;
      case 'match_by_street':
        return GeocodingAccuracy.GEOMETRIC_CENTER;
      default:
        return GeocodingAccuracy.APPROXIMATE;
    }
  }

  // ============================================================================
  // Private: Error Handling
  // ============================================================================

  private handleError(error: unknown, context: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      this.logger.error(
        `Geoapify API error in ${context}: status=${status}`,
        data || axiosError.message,
      );

      if (status === 401 || status === 403) {
        throw new HttpException(
          'Geoapify API key is invalid or has insufficient permissions',
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (status === 429) {
        throw new HttpException(
          'Geoapify rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else {
      this.logger.error(`Error in ${context}:`, error);
    }
  }
}
