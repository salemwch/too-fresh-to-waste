/**
 * Establishment Types
 * Type definitions for establishments matching backend schema
 */

import type { ID, Timestamp } from '@/types';

// Enums — single source of truth from shared package
export { EstablishmentType, EstablishmentStatus } from '@foodwaste/shared';
import { EstablishmentType, EstablishmentStatus } from '@foodwaste/shared';

export interface EstablishmentAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface BusinessHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
}

export interface Establishment {
  id: ID;
  name: string;
  description: string;
  type: EstablishmentType;
  status: EstablishmentStatus;
  address: EstablishmentAddress;
  phoneNumber: string;
  email: string;
  website?: string;
  images: string[];
  cuisineTypes?: string[];
  businessHours?: BusinessHours;
  averageRating: number;
  totalReviews: number;
  totalOffers: number;
  completedOrders: number;
  isActive: boolean;
  isVerified: boolean;
  acceptsReservations: boolean;
  verifiedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
