import { OfferStatus, OfferType } from '../enums/offer.enum';

export interface OfferPricing {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: string;
}

export interface Offer {
  id: string;
  title: string;
  description?: string;
  type: OfferType;
  status: OfferStatus;
  pricing: OfferPricing;
  quantity: number;
  quantityRemaining: number;
  images?: string[];
  pickupStartTime: string;
  pickupEndTime: string;
  establishmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferRequest {
  title: string;
  description?: string;
  type: OfferType;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  pickupStartTime: string;
  pickupEndTime: string;
}
