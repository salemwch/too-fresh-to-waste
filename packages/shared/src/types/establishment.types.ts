import { EstablishmentType, EstablishmentStatus, DocumentType } from '../enums/establishment.enum';

/**
 * Address shape returned when an establishment is populated within
 * another document (e.g., Offer.establishmentId after .populate()).
 * Combines street-level fields with optional GeoJSON coordinates.
 */
export interface PopulatedEstablishmentAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  formattedAddress?: string;
  coordinates?: {
    type?: string;
    coordinates?: [number, number]; // [longitude, latitude] GeoJSON
  };
}

export interface Establishment {
  id: string;
  name: string;
  type: EstablishmentType;
  status: EstablishmentStatus;
  description?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  ownerId: string;
  googlePlaceId?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEstablishmentRequest {
  name: string;
  type: EstablishmentType;
  description?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  phone?: string;
  email?: string;
  website?: string;
}

export interface EstablishmentDocument {
  id: string;
  type: DocumentType;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
}
