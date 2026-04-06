import { DistanceUnit } from '../interfaces/geolocation.interface';

import type { GeoCoordinate, Distance } from '../interfaces/geolocation.interface';

/**
 * Earth's radius in different units
 */
export const EARTH_RADIUS = {
  METERS: 6371000,
  KILOMETERS: 6371,
  MILES: 3959,
} as const;

/**
 * Calculate distance between two points using Haversine formula
 */
export class DistanceCalculator {
  /**
   * Calculate distance between two geographic coordinates
   * @param point1 First coordinate
   * @param point2 Second coordinate
   * @param unit Distance unit
   * @returns Distance object with value and formatted string
   */
  static calculateDistance(
    point1: GeoCoordinate,
    point2: GeoCoordinate,
    unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): Distance {
    const distanceInMeters = this.haversineDistance(point1, point2);

    const value = this.convertDistance(distanceInMeters, DistanceUnit.METERS, unit);
    const formatted = this.formatDistance(value, unit);

    return {
      value,
      unit,
      formatted,
    };
  }

  /**
   * Calculate distance using Haversine formula (returns meters)
   */
  private static haversineDistance(point1: GeoCoordinate, point2: GeoCoordinate): number {
    const lat1Rad = this.degreesToRadians(point1.latitude);
    const lat2Rad = this.degreesToRadians(point2.latitude);
    const deltaLatRad = this.degreesToRadians(point2.latitude - point1.latitude);
    const deltaLngRad = this.degreesToRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS.METERS * c;
  }

  /**
   * Calculate bearing between two points
   */
  static calculateBearing(point1: GeoCoordinate, point2: GeoCoordinate): number {
    const lat1Rad = this.degreesToRadians(point1.latitude);
    const lat2Rad = this.degreesToRadians(point2.latitude);
    const deltaLngRad = this.degreesToRadians(point2.longitude - point1.longitude);

    const y = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

    const bearingRad = Math.atan2(y, x);
    return (this.radiansToDegrees(bearingRad) + 360) % 360;
  }

  /**
   * Calculate destination point given distance and bearing
   */
  static calculateDestination(
    origin: GeoCoordinate,
    distance: number,
    bearing: number,
    unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): GeoCoordinate {
    const distanceInMeters = this.convertDistance(distance, unit, DistanceUnit.METERS);
    const angularDistance = distanceInMeters / EARTH_RADIUS.METERS;
    const bearingRad = this.degreesToRadians(bearing);
    const lat1Rad = this.degreesToRadians(origin.latitude);
    const lng1Rad = this.degreesToRadians(origin.longitude);

    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
        Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad),
    );

    const lng2Rad =
      lng1Rad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
        Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad),
      );

    return {
      latitude: this.radiansToDegrees(lat2Rad),
      longitude: this.radiansToDegrees(lng2Rad),
    };
  }

  /**
   * Check if a point is within a circular area
   */
  static isPointInRadius(
    center: GeoCoordinate,
    point: GeoCoordinate,
    radius: number,
    unit: DistanceUnit = DistanceUnit.METERS,
  ): boolean {
    const distance = this.calculateDistance(center, point, unit);
    return distance.value <= radius;
  }

  /**
   * Calculate bounding box for a circular area
   */
  static getBoundingBox(
    center: GeoCoordinate,
    radius: number,
    unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): {
    northeast: GeoCoordinate;
    southwest: GeoCoordinate;
  } {
    const radiusInKm = this.convertDistance(radius, unit, DistanceUnit.KILOMETERS);

    // Rough approximation for bounding box
    const latOffset = radiusInKm / 111.32; // 1 degree latitude ≈ 111.32 km
    const lngOffset = radiusInKm / (111.32 * Math.cos(this.degreesToRadians(center.latitude)));

    return {
      northeast: {
        latitude: center.latitude + latOffset,
        longitude: center.longitude + lngOffset,
      },
      southwest: {
        latitude: center.latitude - latOffset,
        longitude: center.longitude - lngOffset,
      },
    };
  }

  /**
   * Sort points by distance from a reference point
   */
  static sortByDistance<T extends { coordinates: GeoCoordinate }>(
    points: T[],
    reference: GeoCoordinate,
    unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): Array<T & { distance: Distance }> {
    return points
      .map(point => ({
        ...point,
        distance: this.calculateDistance(reference, point.coordinates, unit),
      }))
      .sort((a, b) => a.distance.value - b.distance.value);
  }

  /**
   * Filter points within a radius
   */
  static filterByRadius<T extends { coordinates: GeoCoordinate }>(
    points: T[],
    center: GeoCoordinate,
    radius: number,
    unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): Array<T & { distance: Distance }> {
    return points
      .map(point => ({
        ...point,
        distance: this.calculateDistance(center, point.coordinates, unit),
      }))
      .filter(point => point.distance.value <= radius)
      .sort((a, b) => a.distance.value - b.distance.value);
  }

  /**
   * Convert distance between units
   */
  static convertDistance(value: number, fromUnit: DistanceUnit, toUnit: DistanceUnit): number {
    if (fromUnit === toUnit) {
      return value;
    }

    // Convert to meters first
    let meters: number;
    switch (fromUnit) {
      case DistanceUnit.METERS:
        meters = value;
        break;
      case DistanceUnit.KILOMETERS:
        meters = value * 1000;
        break;
      case DistanceUnit.MILES:
        meters = value * 1609.344;
        break;
    }

    // Convert from meters to target unit
    switch (toUnit) {
      case DistanceUnit.METERS:
        return meters;
      case DistanceUnit.KILOMETERS:
        return meters / 1000;
      case DistanceUnit.MILES:
        return meters / 1609.344;
    }
  }

  /**
   * Format distance for display
   */
  static formatDistance(value: number, unit: DistanceUnit): string {
    const roundedValue = Math.round(value * 100) / 100;

    switch (unit) {
      case DistanceUnit.METERS:
        return roundedValue >= 1000
          ? `${Math.round((roundedValue / 1000) * 10) / 10} km`
          : `${Math.round(roundedValue)} m`;
      case DistanceUnit.KILOMETERS:
        return roundedValue < 1 ? `${Math.round(roundedValue * 1000)} m` : `${roundedValue} km`;
      case DistanceUnit.MILES:
        return `${roundedValue} mi`;
      default:
        return `${roundedValue} ${unit}`;
    }
  }

  /**
   * Validate coordinates
   */
  static isValidCoordinate(coord: GeoCoordinate): boolean {
    return (
      coord.latitude >= -90 &&
      coord.latitude <= 90 &&
      coord.longitude >= -180 &&
      coord.longitude <= 180 &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude)
    );
  }

  /**
   * Convert GeoJSON Point to GeoCoordinate
   */
  static pointToCoordinate(point: { coordinates: [number, number] }): GeoCoordinate {
    return {
      longitude: point.coordinates[0],
      latitude: point.coordinates[1],
    };
  }

  /**
   * Convert GeoCoordinate to GeoJSON Point
   */
  static coordinateToPoint(coord: GeoCoordinate): { type: 'Point'; coordinates: [number, number] } {
    return {
      type: 'Point',
      coordinates: [coord.longitude, coord.latitude],
    };
  }

  /**
   * Helper: Convert degrees to radians
   */
  private static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Helper: Convert radians to degrees
   */
  private static radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate center point of multiple coordinates
   */
  static calculateCenter(coordinates: GeoCoordinate[]): GeoCoordinate {
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate center of empty coordinates array');
    }

    let totalLat = 0;
    let totalLng = 0;

    for (const coord of coordinates) {
      totalLat += coord.latitude;
      totalLng += coord.longitude;
    }

    return {
      latitude: totalLat / coordinates.length,
      longitude: totalLng / coordinates.length,
    };
  }

  /**
   * Generate random coordinates within a radius (for testing)
   */
  static generateRandomCoordinatesInRadius(
    center: GeoCoordinate,
    radiusInKm: number,
    count: number = 1,
  ): GeoCoordinate[] {
    const coordinates: GeoCoordinate[] = [];

    for (let i = 0; i < count; i++) {
      const randomDistance = Math.random() * radiusInKm;
      const randomBearing = Math.random() * 360;

      const randomPoint = this.calculateDestination(
        center,
        randomDistance,
        randomBearing,
        DistanceUnit.KILOMETERS,
      );

      coordinates.push(randomPoint);
    }

    return coordinates;
  }
}
