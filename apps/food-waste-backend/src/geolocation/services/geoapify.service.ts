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

      const baseParams = { lat, lon: lng, lang: language, apiKey: this.apiKey };

      // Three parallel calls at different granularity levels (no serial latency).
      //   default = street-level — full address details (street, postcode, formatted)
      //   suburb  = municipality boundary — e.g. "Messadine" inside Msaken delegation
      //   city    = city-level boundary — fallback when area is not modelled as a suburb
      const [defaultResult, suburbResult, cityResult] = await Promise.allSettled([
        this.axiosInstance.get<GeoapifyResponse>('/reverse', { params: baseParams }),
        this.axiosInstance.get<GeoapifyResponse>('/reverse', {
          params: { ...baseParams, type: 'suburb' },
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

      // Log every returned feature so the exact field where the municipality name
      // lives is always visible in backend logs — essential for diagnosing locality mismatches.
      features.forEach((f, i) => {
        const p = f.properties;
        this.logger.debug(
          `[geocode feature ${i}] result_type=${p.result_type ?? '—'} | ` +
            `name=${p.name ?? '—'} | suburb=${p.suburb ?? '—'} | ` +
            `district=${p.district ?? '—'} | city=${p.city ?? '—'} | ` +
            `county=${p.county ?? '—'} | state=${p.state ?? '—'} | ` +
            `formatted="${p.formatted}"`,
        );
      });

      const suburbFeature =
        suburbResult.status === 'fulfilled' ? suburbResult.value.data?.features?.[0] : undefined;
      const cityFeature =
        cityResult.status === 'fulfilled' ? cityResult.value.data?.features?.[0] : undefined;

      this.logger.debug(
        `[suburb-call] name=${suburbFeature?.properties.name ?? '—'} | ` +
          `result_type=${suburbFeature?.properties.result_type ?? '—'}`,
      );
      this.logger.debug(
        `[city-call]   name=${cityFeature?.properties.name ?? '—'} | ` +
          `result_type=${cityFeature?.properties.result_type ?? '—'}`,
      );

      const addresses = features.map(f => this.mapPropertiesToAddress(f.properties));
      const primaryAddress = addresses[0] ?? {
        city: '',
        postalCode: '',
        country: '',
        formattedAddress: '',
      };

      // Locality resolution — four layers, most-specific first:
      // 1. suburb-type result name  — finest granularity (e.g. "Messadine")
      // 2. city-type result name    — city/commune boundary fallback
      // 3. formatted string parse   — extract the token between street and delegation
      // 4. existing field hierarchy — already set in primaryAddress (district → city → …)
      const localityOverride =
        suburbFeature?.properties.name ??
        cityFeature?.properties.name ??
        this.extractLocalityFromFormatted(primaryFeature.properties);

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
   * Extract the locality (municipality/town) from Geoapify's `formatted` address string.
   *
   * A street-level `formatted` value looks like:
   *   "Rue de la Paix, Messadine, M'saken, Sousse Governorate, Tunisia"
   *
   * Strategy:
   * 1. Split on ", " and strip trailing tokens that match the known country, state, county,
   *    or look like a postcode (3–6 digits).
   * 2. For street / building / amenity result_types skip the leading street component.
   * 3. The next token is the municipality: "Messadine".
   */
  private extractLocalityFromFormatted(props: GeoapifyFeatureProperties): string | undefined {
    if (!props.formatted) {
      return undefined;
    }

    const parts = props.formatted
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const stripValues = new Set(
      [props.country, props.state, props.county].filter((v): v is string => Boolean(v)),
    );

    const stripped = parts.filter(p => !stripValues.has(p) && !/^\d{3,6}$/.test(p));

    const isStreetLevel = ['street', 'building', 'amenity'].includes(props.result_type ?? '');
    const candidates = isStreetLevel && stripped.length > 1 ? stripped.slice(1) : stripped;

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
