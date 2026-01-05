import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  SaveLocationDto,
  UpdateLocationPreferencesDto,
} from '../dto/geolocation.dto';
import {
  GeoCoordinate,
  UserLocationPreferences,
  SavedLocation,
  LocationHistoryEntry,
  LocationCategory,
  LocationSource,
  AddressInfo
} from '../interfaces/geolocation.interface';
import { GeolocationService } from './geolocation.service';
import { DistanceCalculator } from '../utils/distance.util';

@Injectable()
export class UserLocationService {
  private readonly logger = new Logger(UserLocationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly geolocationService: GeolocationService,
  ) {}

  /**
   * Get user's location preferences
   */
  async getUserLocationPreferences(userId: string): Promise<UserLocationPreferences> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user.locationPreferences as UserLocationPreferences || this.getDefaultLocationPreferences();

    } catch (error) {
      this.logger.error('Failed to get user location preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's location preferences
   */
  async updateLocationPreferences(
    userId: string,
    dto: UpdateLocationPreferencesDto
  ): Promise<UserLocationPreferences> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate default location coordinates if provided
      if (dto.defaultLocation && !DistanceCalculator.isValidCoordinate(dto.defaultLocation)) {
        throw new BadRequestException('Invalid default location coordinates');
      }

      const updatedPreferences: Partial<UserLocationPreferences> = {
        ...(user.locationPreferences as UserLocationPreferences),
        ...dto,
        defaultLocation: dto.defaultLocation || user.locationPreferences?.defaultLocation
      };

      await this.userModel.findByIdAndUpdate(
        userId,
        { locationPreferences: updatedPreferences },
        { new: true }
      ).exec();

      this.logger.log(`Updated location preferences for user ${userId}`);
      return updatedPreferences as UserLocationPreferences;

    } catch (error) {
      this.logger.error('Failed to update location preferences:', error);
      throw error;
    }
  }

  /**
   * Save a new location for user
   */
  async saveUserLocation(userId: string, dto: SaveLocationDto): Promise<SavedLocation> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!DistanceCalculator.isValidCoordinate(dto.coordinates)) {
        throw new BadRequestException('Invalid coordinates');
      }

      // Create new saved location
      const savedLocation: SavedLocation = {
        id: new Types.ObjectId().toString(),
        name: dto.name,
        coordinates: dto.coordinates,
        address: {
          street: dto.street,
          city: dto.city || 'Unknown',
          postalCode: dto.postalCode || '',
          country: dto.country || 'Unknown',
          formattedAddress: this.formatAddress({
            street: dto.street,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country
          })
        },
        category: dto.category,
        createdAt: new Date()
      };

      // Initialize preferences if not exist
      if (!user.locationPreferences) {
        user.locationPreferences = this.getDefaultLocationPreferences();
      }

      // Add to saved locations
      user.locationPreferences.savedLocations.push(savedLocation);

      // Limit saved locations to prevent unbounded growth
      const maxSavedLocations = 20;
      if (user.locationPreferences.savedLocations.length > maxSavedLocations) {
        user.locationPreferences.savedLocations = user.locationPreferences.savedLocations
          .slice(-maxSavedLocations);
      }

      await user.save();

      this.logger.log(`Saved location "${dto.name}" for user ${userId}`);
      return savedLocation;

    } catch (error) {
      this.logger.error('Failed to save user location:', error);
      throw error;
    }
  }

  /**
   * Update saved location
   */
  async updateSavedLocation(
    userId: string,
    locationId: string,
    updates: Partial<SaveLocationDto>
  ): Promise<SavedLocation> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.locationPreferences) {
        throw new NotFoundException('User or location preferences not found');
      }

      const locationIndex = user.locationPreferences.savedLocations
        .findIndex(loc => loc.id === locationId);

      if (locationIndex === -1) {
        throw new NotFoundException('Saved location not found');
      }

      // Validate coordinates if being updated
      if (updates.coordinates && !DistanceCalculator.isValidCoordinate(updates.coordinates)) {
        throw new BadRequestException('Invalid coordinates');
      }

      const currentLocation = user.locationPreferences.savedLocations[locationIndex];

      // Update the location
      const updatedLocation: SavedLocation = {
        ...currentLocation,
        name: updates.name || currentLocation.name,
        coordinates: updates.coordinates || currentLocation.coordinates,
        category: updates.category || (currentLocation.category as LocationCategory),
        address: {
          ...currentLocation.address,
          street: updates.street || currentLocation.address.street,
          city: updates.city || currentLocation.address.city,
          postalCode: updates.postalCode || currentLocation.address.postalCode,
          country: updates.country || currentLocation.address.country,
          formattedAddress: this.formatAddress({
            street: updates.street || currentLocation.address.street,
            city: updates.city || currentLocation.address.city,
            postalCode: updates.postalCode || currentLocation.address.postalCode,
            country: updates.country || currentLocation.address.country
          })
        }
      };

      user.locationPreferences.savedLocations[locationIndex] = updatedLocation;
      await user.save();

      this.logger.log(`Updated saved location ${locationId} for user ${userId}`);
      return updatedLocation;

    } catch (error) {
      this.logger.error('Failed to update saved location:', error);
      throw error;
    }
  }

  /**
   * Delete saved location
   */
  async deleteSavedLocation(userId: string, locationId: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.locationPreferences) {
        throw new NotFoundException('User or location preferences not found');
      }

      const initialLength = user.locationPreferences.savedLocations.length;
      user.locationPreferences.savedLocations = user.locationPreferences.savedLocations
        .filter(loc => loc.id !== locationId);

      if (user.locationPreferences.savedLocations.length === initialLength) {
        throw new NotFoundException('Saved location not found');
      }

      await user.save();
      this.logger.log(`Deleted saved location ${locationId} for user ${userId}`);

    } catch (error) {
      this.logger.error('Failed to delete saved location:', error);
      throw error;
    }
  }

  /**
   * Get user's saved locations
   */
  async getSavedLocations(userId: string): Promise<SavedLocation[]> {
    try {
      const preferences = await this.getUserLocationPreferences(userId);
      return preferences.savedLocations || [];

    } catch (error) {
      this.logger.error('Failed to get saved locations:', error);
      throw error;
    }
  }

  /**
   * Get saved locations by category
   */
  async getSavedLocationsByCategory(
    userId: string,
    category: LocationCategory
  ): Promise<SavedLocation[]> {
    try {
      const savedLocations = await this.getSavedLocations(userId);
      return savedLocations.filter(loc => loc.category === category);

    } catch (error) {
      this.logger.error('Failed to get saved locations by category:', error);
      throw error;
    }
  }

  /**
   * Record location in user's history
   */
  async recordLocationHistory(
    userId: string,
    coordinates: GeoCoordinate,
    accuracy: number = 100,
    source: LocationSource = LocationSource.MANUAL
  ): Promise<void> {
    try {
      if (!DistanceCalculator.isValidCoordinate(coordinates)) {
        throw new BadRequestException('Invalid coordinates');
      }

      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.locationPreferences) {
        user.locationPreferences = this.getDefaultLocationPreferences();
      }

      const historyEntry: LocationHistoryEntry = {
        coordinates,
        timestamp: new Date(),
        accuracy,
        source
      };

      user.locationPreferences.locationHistory.push(historyEntry);

      // Keep only recent history (last 100 entries)
      const maxHistoryEntries = 100;
      if (user.locationPreferences.locationHistory.length > maxHistoryEntries) {
        user.locationPreferences.locationHistory = user.locationPreferences.locationHistory
          .slice(-maxHistoryEntries);
      }

      await user.save();
      this.logger.log(`Recorded location history for user ${userId}`);

    } catch (error) {
      this.logger.error('Failed to record location history:', error);
      throw error;
    }
  }

  /**
   * Get user's location history
   */
  async getLocationHistory(
    userId: string,
    limit: number = 50
  ): Promise<LocationHistoryEntry[]> {
    try {
      const preferences = await this.getUserLocationPreferences(userId);
      const history = preferences.locationHistory || [];

      return history
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

    } catch (error) {
      this.logger.error('Failed to get location history:', error);
      throw error;
    }
  }

  /**
   * Clear user's location history
   */
  async clearLocationHistory(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(
        userId,
        { 'locationPreferences.locationHistory': [] }
      ).exec();

      this.logger.log(`Cleared location history for user ${userId}`);

    } catch (error) {
      this.logger.error('Failed to clear location history:', error);
      throw error;
    }
  }

  /**
   * Get user's current/last known location
   */
  async getUserCurrentLocation(userId: string): Promise<GeoCoordinate | null> {
    try {
      const preferences = await this.getUserLocationPreferences(userId);

      // First try to get from location history (most recent)
      if (preferences.locationHistory?.length > 0) {
        const mostRecent = preferences.locationHistory
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        return mostRecent.coordinates;
      }

      // Fallback to default location
      return preferences.defaultLocation || null;

    } catch (error) {
      this.logger.error('Failed to get user current location:', error);
      return null;
    }
  }

  /**
   * Get default location preferences
   */
  private getDefaultLocationPreferences(): UserLocationPreferences {
    return {
      searchRadius: 5000, // 5km default
      savedLocations: [] as SavedLocation[],
      locationHistory: [] as LocationHistoryEntry[],
      autoDetectLocation: true,
      shareLocation: true
    };
  }

  /**
   * Format address string
   */
  private formatAddress(address: Partial<AddressInfo>): string {
    const parts = [
      address.street,
      address.city,
      address.postalCode,
      address.country
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Find nearby saved locations
   */
  async findNearbySavedLocations(
    userId: string,
    center: GeoCoordinate,
    radiusInMeters: number = 1000
  ): Promise<Array<SavedLocation & { distance: number }>> {
    try {
      if (!DistanceCalculator.isValidCoordinate(center)) {
        throw new BadRequestException('Invalid center coordinates');
      }

      const savedLocations = await this.getSavedLocations(userId);

      const nearby = savedLocations
        .map(location => ({
          ...location,
          distance: DistanceCalculator.calculateDistance(
            center,
            location.coordinates
          ).value * 1000 // Convert to meters
        }))
        .filter(location => location.distance <= radiusInMeters)
        .sort((a, b) => a.distance - b.distance);

      this.logger.log(`Found ${nearby.length} nearby saved locations for user ${userId}`);
      return nearby;

    } catch (error) {
      this.logger.error('Failed to find nearby saved locations:', error);
      throw error;
    }
  }
}