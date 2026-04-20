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
  // Commune / municipality-level fields — Geoapify may return these for finer granularity
  municipality?: string;
  locality?: string;
  village?: string;
  town?: string;
  city?: string;
  district?: string;
  suburb?: string;
  name?: string;
  postcode?: string;
  street?: string;
  housenumber?: string;
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  lat: number;
  lon: number;
  result_type?: string;
  rank?: {
    importance?: number;
    confidence?: number;
    confidence_city_level?: number;
    match_type?: string;
  };
  // Allow any additional Geoapify fields we have not yet mapped
  [key: string]: unknown;
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

      const baseParams = { lat, lon: lng, lang: language, apiKey: this.apiKey };

      // Four parallel calls at different granularity levels (no serial latency).
      //   default  = most precise match (amenity / street / building) — full address data
      //   suburb   = suburb / quarter boundary
      //   district = commune / town boundary (e.g. "Messadine" under M'Saken delegation)
      //   city     = city-level boundary — broadest fallback
      const [defaultResult, suburbResult, districtResult, cityResult] = await Promise.allSettled([
        this.axiosInstance.get<GeoapifyResponse>('/reverse', { params: baseParams }),
        this.axiosInstance.get<GeoapifyResponse>('/reverse', {
          params: { ...baseParams, type: 'suburb' },
        }),
        this.axiosInstance.get<GeoapifyResponse>('/reverse', {
          params: { ...baseParams, type: 'district' },
        }),
        this.axiosInstance.get<GeoapifyResponse>('/reverse', {
          params: { ...baseParams, type: 'city' },
        }),
      ]);

      if (defaultResult.status === 'rejected') {
        this.handleError(defaultResult.reason, 'reverseGeocode');
        throw new HttpException('Reverse geocoding failed', HttpStatus.BAD_GATEWAY);
      }

      const features = defaultResult.value.data?.features ?? [];

      if (features.length === 0) {
        this.logger.warn(`No results for reverse geocode: lat=${lat}, lng=${lng}`);
        return {
          coordinates: { latitude: lat, longitude: lng },
          addresses: [],
          primaryAddress: { city: '', postalCode: '', country: '', formattedAddress: '' },
        };
      }

      const primaryFeature = features[0];
      if (!primaryFeature) {
        return {
          coordinates: { latitude: lat, longitude: lng },
          addresses: [],
          primaryAddress: { city: '', postalCode: '', country: '', formattedAddress: '' },
        };
      }

      // Log every feature with its complete raw JSON so no hidden field is missed.
      features.forEach((f, i) => {
        this.logger.debug(`[geocode feature ${i}] ${JSON.stringify(f.properties)}`);
      });

      // Extract results for typed calls — only trust the name when the returned
      // result_type actually matches what we requested (Geoapify silently upgrades
      // to the nearest higher-level boundary when the requested type has no data).
      const suburbFeature =
        suburbResult.status === 'fulfilled' ? suburbResult.value.data?.features?.[0] : undefined;
      const districtFeature =
        districtResult.status === 'fulfilled'
          ? districtResult.value.data?.features?.[0]
          : undefined;
      const cityFeature =
        cityResult.status === 'fulfilled' ? cityResult.value.data?.features?.[0] : undefined;

      const suburbName =
        suburbFeature?.properties.result_type === 'suburb'
          ? suburbFeature.properties.name
          : undefined;
      const districtName =
        districtFeature?.properties.result_type === 'district'
          ? districtFeature.properties.name
          : undefined;
      const cityName =
        cityFeature?.properties.result_type === 'city' ? cityFeature.properties.name : undefined;

      this.logger.debug(
        `[suburb-call]   result_type=${suburbFeature?.properties.result_type ?? '—'} | name=${suburbFeature?.properties.name ?? '—'} | accepted=${suburbName ?? '✗'}`,
      );
      this.logger.debug(
        `[district-call] result_type=${districtFeature?.properties.result_type ?? '—'} | name=${districtFeature?.properties.name ?? '—'} | accepted=${districtName ?? '✗'}`,
      );
      this.logger.debug(
        `[city-call]     result_type=${cityFeature?.properties.result_type ?? '—'} | name=${cityFeature?.properties.name ?? '—'} | accepted=${cityName ?? '✗'}`,
      );

      const addresses = features.map(f => this.mapPropertiesToAddress(f.properties));
      const primaryAddress = addresses[0] ?? {
        city: '',
        postalCode: '',
        country: '',
        formattedAddress: '',
      };

      // Locality resolution — five layers, most-specific first.
      // Amenity names (mosques, schools, etc.) are deliberately excluded from all
      // layers — they identify a POI, not the place the user is in.
      //
      // 1. suburb-type call name    — finest boundary (quarter / small commune)
      // 2. district-type call name  — commune / town boundary (e.g. "Messadine")
      // 3. city-type call name      — city boundary (validated: not silently upgraded)
      // 4. commune fields in primary response: municipality → locality → village → town → suburb
      // 5. formatted-string parse   — second token after skipping amenity/street name
      // 6. county from primary      — delegation name (e.g. "M'Saken") — last resort
      const primaryProps = primaryFeature.properties;
      const communeFromPrimary =
        primaryProps.municipality ??
        primaryProps.locality ??
        primaryProps.village ??
        primaryProps.town ??
        primaryProps.suburb;

      const localityOverride =
        suburbName ??
        districtName ??
        cityName ??
        communeFromPrimary ??
        this.extractLocalityFromFormatted(primaryProps) ??
        primaryProps.county;

      if (localityOverride) {
        primaryAddress.city = localityOverride;
        this.logger.debug(`Locality resolved: "${localityOverride}"`);
      }

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
      throw new HttpException('Reverse geocoding failed', HttpStatus.BAD_GATEWAY);
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
        params['filter'] = `countrycode:${countryCode.toLowerCase()}`;
      }

      const response = await this.axiosInstance.get<GeoapifyResponse>('/search', {
        params,
      });

      const features = response.data?.features ?? [];

      if (features.length === 0) {
        this.logger.warn(`No results for geocode: "${address}"`);
        return [];
      }

      const results = features.map(f => this.mapFeatureToGeocodingResult(f));

      this.logger.log(`Geocode completed: "${address}" - ${results.length} result(s)`);
      return results;
    } catch (error) {
      this.handleError(error, 'geocodeAddress');
      throw new HttpException('Forward geocoding failed', HttpStatus.BAD_GATEWAY);
    }
  }

  // ============================================================================
  // Private: Response Mapping
  // ============================================================================

  private mapPropertiesToAddress(props: GeoapifyFeatureProperties): AddressInfo {
    const street = props.housenumber
      ? `${props.housenumber}, ${props.street ?? ''}`
      : (props.street ?? '');

    // Prefer the most granular settlement-level name available.
    // `name` is only trusted when result_type indicates a settlement (city/suburb/village/etc).
    // For street or building result_types, `name` is the street/building name — skip it.
    const SETTLEMENT_TYPES = new Set([
      'city',
      'suburb',
      'village',
      'hamlet',
      'locality',
      'district',
      'county',
      'state',
      'region',
      'postcode',
    ]);
    const nameIsSettlement = !props.result_type || SETTLEMENT_TYPES.has(props.result_type);

    const city =
      props.suburb ??
      (nameIsSettlement ? props.name : undefined) ??
      props.district ??
      props.city ??
      props.county ??
      props.state ??
      '';

    return {
      street: street || undefined,
      city,
      postalCode: props.postcode ?? '',
      country: props.country ?? '',
      formattedAddress: props.formatted ?? '',
    };
  }

  /**
   * Extract the locality name from Geoapify's `formatted` address string.
   *
   * Examples:
   *   amenity → "Sidi Joubrane, M'Saken, Tunisia"       → skip POI name → "M'Saken"
   *   street  → "Rue X, Messadine, M'Saken, Sousse, TN" → skip street   → "Messadine"
   *   suburb  → "Messadine, M'Saken, Tunisia"            → first token   → "Messadine"
   *
   * Strategy:
   * 1. Split on ", " and remove the trailing country token and pure postcodes.
   *    We intentionally keep county / state tokens so they can surface as fallback.
   * 2. For amenity / street / building results skip the leading POI/street token.
   * 3. Return the first remaining token.
   */
  private extractLocalityFromFormatted(props: GeoapifyFeatureProperties): string | undefined {
    if (!props.formatted) {
      return undefined;
    }

    const parts = props.formatted
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // Strip only the country name and bare postcodes — keep county / state so
    // they surface as fallback tokens rather than leaving an empty array.
    const stripped = parts.filter(p => p !== props.country && !/^\d{3,6}$/.test(p));

    const skipFirst = ['amenity', 'street', 'building'].includes(props.result_type ?? '');
    const candidates = skipFirst && stripped.length > 1 ? stripped.slice(1) : stripped;

    return candidates[0] ?? undefined;
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
    if (matchType === undefined) {
      return GeocodingAccuracy.APPROXIMATE;
    }

    switch (matchType) {
      case 'full_match':
        return GeocodingAccuracy.ROOFTOP;
      case 'inner_part':
        return GeocodingAccuracy.RANGE_INTERPOLATED;
      case 'match_by_street':
        return GeocodingAccuracy.GEOMETRIC_CENTER;
    }

    return GeocodingAccuracy.APPROXIMATE;
  }

  // ============================================================================
  // Private: Error Handling
  // ============================================================================

  private handleError(error: unknown, context: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;
      const errorDetails = data ?? axiosError.message;

      this.logger.error(`Geoapify API error in ${context}: status=${status}`, errorDetails);

      if (status === 401 || status === 403) {
        throw new HttpException(
          'Geoapify API key is invalid or has insufficient permissions',
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (status === 429) {
        throw new HttpException('Geoapify rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
    } else {
      this.logger.error(`Error in ${context}:`, error);
    }
  }
}
