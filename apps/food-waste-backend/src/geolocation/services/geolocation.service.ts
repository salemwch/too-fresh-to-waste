import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as iso31661alpha2 from 'iso-3166-1-alpha-2';
import {
  GeoCoordinate,
  Distance,
  DistanceUnit,
  GeocodingResult,
  ReverseGeocodingResult,
  GeofenceResult,
  GeoPoint,
  AddressInfo
} from '../interfaces/geolocation.interface';
import {
  DistanceCalculationDto,
  GeocodingDto,
  ReverseGeocodingDto,
  GeofenceCheckDto
} from '../dto/geolocation.dto';
import { DistanceCalculator } from '../utils/distance.util';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Establishment, EstablishmentDocument } from '../../establishments/schemas/establishment.schema';
import { GeoapifyService } from './geoapify.service';

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Establishment.name) private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly geoapifyService: GeoapifyService,
  ) {}

  /**
   * Calculate distance between two points
   */
  calculateDistance(dto: DistanceCalculationDto): Distance {
    try {
      if (!DistanceCalculator.isValidCoordinate(dto.origin)) {
        throw new BadRequestException('Invalid origin coordinates');
      }

      if (!DistanceCalculator.isValidCoordinate(dto.destination)) {
        throw new BadRequestException('Invalid destination coordinates');
      }

      return DistanceCalculator.calculateDistance(
        dto.origin,
        dto.destination,
        dto.unit || DistanceUnit.KILOMETERS
      );

    } catch (error) {
      this.logger.error('Failed to calculate distance:', error);
      throw error;
    }
  }

  /**
   * Calculate multiple distances from one origin to multiple destinations
   */
  calculateDistances(
    origin: GeoCoordinate,
    destinations: GeoCoordinate[],
    unit: DistanceUnit = DistanceUnit.KILOMETERS
  ): Distance[] {
    try {
      if (!DistanceCalculator.isValidCoordinate(origin)) {
        throw new BadRequestException('Invalid origin coordinates');
      }

      return destinations.map(destination => {
        if (!DistanceCalculator.isValidCoordinate(destination)) {
          throw new BadRequestException('Invalid destination coordinates');
        }
        return DistanceCalculator.calculateDistance(origin, destination, unit);
      });

    } catch (error) {
      this.logger.error('Failed to calculate distances:', error);
      throw error;
    }
  }

  /**
   * Check if point is within geofence
   */
  checkGeofence(dto: GeofenceCheckDto): GeofenceResult {
    try {
      if (!DistanceCalculator.isValidCoordinate(dto.point)) {
        throw new BadRequestException('Invalid point coordinates');
      }

      if (!DistanceCalculator.isValidCoordinate(dto.geofence.center)) {
        throw new BadRequestException('Invalid geofence center coordinates');
      }

      const distance = DistanceCalculator.calculateDistance(
        dto.geofence.center,
        dto.point,
        DistanceUnit.METERS
      );

      const isInside = distance.value <= dto.geofence.radius;

      return {
        isInside,
        distance,
        geofence: {
          center: dto.geofence.center,
          radius: dto.geofence.radius,
          name: dto.geofence.name,
          description: dto.geofence.description
        }
      };

    } catch (error) {
      this.logger.error('Failed to check geofence:', error);
      throw error;
    }
  }

  /**
   * Get bounding box for a circular area
   */
  getBoundingBox(
    center: GeoCoordinate,
    radius: number,
    unit: DistanceUnit = DistanceUnit.KILOMETERS
  ): { northeast: GeoCoordinate; southwest: GeoCoordinate } {
    try {
      if (!DistanceCalculator.isValidCoordinate(center)) {
        throw new BadRequestException('Invalid center coordinates');
      }

      return DistanceCalculator.getBoundingBox(center, radius, unit);

    } catch (error) {
      this.logger.error('Failed to calculate bounding box:', error);
      throw error;
    }
  }

  /**
   * Convert coordinates to GeoJSON Point
   */
  coordinateToGeoPoint(coordinate: GeoCoordinate): GeoPoint {
    if (!DistanceCalculator.isValidCoordinate(coordinate)) {
      throw new BadRequestException('Invalid coordinates');
    }

    return DistanceCalculator.coordinateToPoint(coordinate);
  }

  /**
   * Convert GeoJSON Point to coordinates
   */
  geoPointToCoordinate(point: GeoPoint): GeoCoordinate {
    if (!point.coordinates || point.coordinates.length !== 2) {
      throw new BadRequestException('Invalid GeoJSON point');
    }

    const coordinate = DistanceCalculator.pointToCoordinate(point);

    if (!DistanceCalculator.isValidCoordinate(coordinate)) {
      throw new BadRequestException('Invalid coordinates in GeoJSON point');
    }

    return coordinate;
  }

  /**
   * Geocode address to coordinates via Geoapify
   */
  async geocodeAddress(dto: GeocodingDto): Promise<GeocodingResult[]> {
    return this.geoapifyService.geocodeAddress(
      dto.address,
      dto.language,
      dto.limit,
      dto.countryCode,
    );
  }

  /**
   * Reverse geocode coordinates to address via Geoapify
   */
  async reverseGeocode(dto: ReverseGeocodingDto): Promise<ReverseGeocodingResult> {
    return this.geoapifyService.reverseGeocode(
      dto.coordinates.latitude,
      dto.coordinates.longitude,
      dto.language,
    );
  }

  /**
   * Calculate center point of multiple coordinates
   */
  calculateCenter(coordinates: GeoCoordinate[]): GeoCoordinate {
    try {
      if (!coordinates || coordinates.length === 0) {
        throw new BadRequestException('Coordinates array cannot be empty');
      }

      // Validate all coordinates
      for (const coord of coordinates) {
        if (!DistanceCalculator.isValidCoordinate(coord)) {
          throw new BadRequestException('Invalid coordinates in array');
        }
      }

      return DistanceCalculator.calculateCenter(coordinates);

    } catch (error) {
      this.logger.error('Failed to calculate center:', error);
      throw error;
    }
  }

  /**
   * Sort locations by distance from reference point
   */
  sortLocationsByDistance<T extends { coordinates: GeoCoordinate }>(
    locations: T[],
    reference: GeoCoordinate,
    unit: DistanceUnit = DistanceUnit.KILOMETERS
  ): Array<T & { distance: Distance }> {
    try {
      if (!DistanceCalculator.isValidCoordinate(reference)) {
        throw new BadRequestException('Invalid reference coordinates');
      }

      return DistanceCalculator.sortByDistance(locations, reference, unit);

    } catch (error) {
      this.logger.error('Failed to sort locations by distance:', error);
      throw error;
    }
  }

  /**
   * Filter locations within radius
   */
  filterLocationsByRadius<T extends { coordinates: GeoCoordinate }>(
    locations: T[],
    center: GeoCoordinate,
    radius: number,
    unit: DistanceUnit = DistanceUnit.KILOMETERS
  ): Array<T & { distance: Distance }> {
    try {
      if (!DistanceCalculator.isValidCoordinate(center)) {
        throw new BadRequestException('Invalid center coordinates');
      }

      return DistanceCalculator.filterByRadius(locations, center, radius, unit);

    } catch (error) {
      this.logger.error('Failed to filter locations by radius:', error);
      throw error;
    }
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(coordinate: GeoCoordinate): boolean {
    return DistanceCalculator.isValidCoordinate(coordinate);
  }

  /**
   * Format distance for display
   */
  formatDistance(value: number, unit: DistanceUnit): string {
    return DistanceCalculator.formatDistance(value, unit);
  }

  /**
   * Convert distance between units
   */
  convertDistanceUnit(
    value: number,
    fromUnit: DistanceUnit,
    toUnit: DistanceUnit
  ): number {
    return DistanceCalculator.convertDistance(value, fromUnit, toUnit);
  }

  /**
   * Get coordinates from address info via Geoapify forward geocoding
   */
  async getCoordinatesFromAddress(address: AddressInfo): Promise<GeoCoordinate | null> {
    const query = address.formattedAddress
      || [address.street, address.city, address.country].filter(Boolean).join(', ');

    if (!query) {
      this.logger.warn('getCoordinatesFromAddress: No usable address fields provided');
      return null;
    }

    try {
      const results = await this.geoapifyService.geocodeAddress(query);
      if (results.length > 0) {
        return results[0].coordinates;
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to get coordinates from address:', error);
      return null;
    }
  }

  private getCountryCode(country?: string): string | undefined {
    if (!country) {
      return undefined;
    }

    try {
      // Normalize input: trim whitespace and convert to proper case
      const normalizedCountry = country.trim();

      // Return early if already a valid 2-letter ISO code
      if (/^[A-Z]{2}$/i.test(normalizedCountry)) {
        const upperCode = normalizedCountry.toUpperCase();
        if (iso31661alpha2.getCountry(upperCode)) {
          return upperCode;
        }
      }

      // Comprehensive country name mappings for common variations
      const countryNameMappings: Record<string, string> = {
        // English variations
        'United States': 'US',
        'United States of America': 'US',
        'USA': 'US',
        'America': 'US',
        'US': 'US',

        'United Kingdom': 'GB',
        'Great Britain': 'GB',
        'Britain': 'GB',
        'England': 'GB',
        'UK': 'GB',
        'GB': 'GB',

        'France': 'FR',
        'French Republic': 'FR',

        'Germany': 'DE',
        'Deutschland': 'DE',
        'Federal Republic of Germany': 'DE',

        'Spain': 'ES',
        'España': 'ES',
        'Kingdom of Spain': 'ES',

        'Italy': 'IT',
        'Italia': 'IT',
        'Italian Republic': 'IT',

        'Canada': 'CA',

        'Australia': 'AU',
        'Commonwealth of Australia': 'AU',

        'Netherlands': 'NL',
        'Holland': 'NL',
        'The Netherlands': 'NL',

        'Switzerland': 'CH',
        'Swiss Confederation': 'CH',

        'Austria': 'AT',
        'Republic of Austria': 'AT',

        'Belgium': 'BE',
        'Kingdom of Belgium': 'BE',

        'Sweden': 'SE',
        'Kingdom of Sweden': 'SE',

        'Norway': 'NO',
        'Kingdom of Norway': 'NO',

        'Denmark': 'DK',
        'Kingdom of Denmark': 'DK',

        'Finland': 'FI',
        'Republic of Finland': 'FI',

        'Ireland': 'IE',
        'Republic of Ireland': 'IE',
        'Éire': 'IE',

        'Portugal': 'PT',
        'Portuguese Republic': 'PT',

        'Poland': 'PL',
        'Republic of Poland': 'PL',
        'Polska': 'PL',

        'Czech Republic': 'CZ',
        'Czechia': 'CZ',
        'Czech': 'CZ',

        'Slovakia': 'SK',
        'Slovak Republic': 'SK',

        'Hungary': 'HU',
        'Republic of Hungary': 'HU',
        'Magyarország': 'HU',

        'Slovenia': 'SI',
        'Republic of Slovenia': 'SI',

        'Croatia': 'HR',
        'Republic of Croatia': 'HR',
        'Hrvatska': 'HR',

        'Romania': 'RO',
        'România': 'RO',

        'Bulgaria': 'BG',
        'Republic of Bulgaria': 'BG',

        'Greece': 'GR',
        'Hellenic Republic': 'GR',
        'Hellas': 'GR',

        'Cyprus': 'CY',
        'Republic of Cyprus': 'CY',

        'Malta': 'MT',
        'Republic of Malta': 'MT',

        'Luxembourg': 'LU',
        'Grand Duchy of Luxembourg': 'LU',

        'Lithuania': 'LT',
        'Republic of Lithuania': 'LT',

        'Latvia': 'LV',
        'Republic of Latvia': 'LV',

        'Estonia': 'EE',
        'Republic of Estonia': 'EE',

        // Asian countries
        'China': 'CN',
        'People\'s Republic of China': 'CN',
        'PRC': 'CN',

        'Japan': 'JP',
        'Nippon': 'JP',
        'Nihon': 'JP',

        'South Korea': 'KR',
        'Korea': 'KR',
        'Republic of Korea': 'KR',

        'India': 'IN',
        'Republic of India': 'IN',
        'Bharat': 'IN',

        'Singapore': 'SG',
        'Republic of Singapore': 'SG',

        'Thailand': 'TH',
        'Kingdom of Thailand': 'TH',

        'Malaysia': 'MY',

        'Indonesia': 'ID',
        'Republic of Indonesia': 'ID',

        'Philippines': 'PH',
        'Republic of the Philippines': 'PH',

        'Vietnam': 'VN',
        'Viet Nam': 'VN',
        'Socialist Republic of Vietnam': 'VN',

        // Middle East & Africa

        'United Arab Emirates': 'AE',
        'UAE': 'AE',

        'Saudi Arabia': 'SA',
        'Kingdom of Saudi Arabia': 'SA',
        'tunisie': 'TN',
        'Republic of tunis': 'TN',

        'Turkey': 'TR',
        'Republic of Turkey': 'TR',
        'Türkiye': 'TR',

        'Egypt': 'EG',
        'Arab Republic of Egypt': 'EG',

        'South Africa': 'ZA',
        'Republic of South Africa': 'ZA',

        // Americas
        'Mexico': 'MX',
        'United Mexican States': 'MX',
        'México': 'MX',

        'Brazil': 'BR',
        'Federative Republic of Brazil': 'BR',
        'Brasil': 'BR',

        'Argentina': 'AR',
        'Argentine Republic': 'AR',

        'Chile': 'CL',
        'Republic of Chile': 'CL',

        'Colombia': 'CO',
        'Republic of Colombia': 'CO',

        'Peru': 'PE',
        'Republic of Peru': 'PE',
        'Perú': 'PE',

        'Venezuela': 'VE',
        'Bolivarian Republic of Venezuela': 'VE',

        'Uruguay': 'UY',
        'Eastern Republic of Uruguay': 'UY',

        'Paraguay': 'PY',
        'Republic of Paraguay': 'PY',

        'Bolivia': 'BO',
        'Plurinational State of Bolivia': 'BO',

        'Ecuador': 'EC',
        'Republic of Ecuador': 'EC',

        // Russian and Eastern Europe
        'Russia': 'RU',
        'Russian Federation': 'RU',
        'Russian': 'RU',

        'Ukraine': 'UA',

        'Belarus': 'BY',
        'Republic of Belarus': 'BY',

        // Others
        'New Zealand': 'NZ',
        'Aotearoa': 'NZ'
      };

      // Try exact match first (case-insensitive)
      const exactMatch = Object.keys(countryNameMappings).find(
        key => key.toLowerCase() === normalizedCountry.toLowerCase()
      );

      if (exactMatch) {
        this.logger.debug(`Country code found via exact match: ${normalizedCountry} -> ${countryNameMappings[exactMatch]}`);
        return countryNameMappings[exactMatch];
      }

      // Try partial match for common abbreviations and partial names
      const partialMatch = Object.keys(countryNameMappings).find(
        key => key.toLowerCase().includes(normalizedCountry.toLowerCase()) ||
               normalizedCountry.toLowerCase().includes(key.toLowerCase())
      );

      if (partialMatch) {
        this.logger.debug(`Country code found via partial match: ${normalizedCountry} -> ${countryNameMappings[partialMatch]} (matched: ${partialMatch})`);
        return countryNameMappings[partialMatch];
      }

      // Fallback: try to get country code from iso-3166-1-alpha-2 library
      // This handles additional edge cases and official country names
      try {
        // Try to find by country name using the library's getCountry method
        const countryByName = Object.entries(iso31661alpha2.getData()).find(([, name]) =>
          name.toLowerCase() === normalizedCountry.toLowerCase()
        );

        if (countryByName) {
          this.logger.debug(`Country code found via ISO library: ${normalizedCountry} -> ${countryByName[0]}`);
          return countryByName[0];
        }
      } catch (isoError) {
        this.logger.warn(`ISO library lookup failed for country: ${normalizedCountry}`, isoError);
      }

      // Log when country is not found for monitoring and potential mapping updates
      this.logger.warn(`Country code not found for: "${normalizedCountry}". Consider adding to country mappings.`);
      return undefined;

    } catch (error) {
      this.logger.error(`Error getting country code for: "${country}"`, error);
      return undefined;
    }
  }
}