import { EstablishmentType, EstablishmentStatus } from '@foodwaste/shared';

export { EstablishmentType, EstablishmentStatus };

export interface IEstablishment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly email: string;
  readonly phone: string;
  readonly type: EstablishmentType;
  readonly status: EstablishmentStatus;
  readonly address: IEstablishmentAddress;
  readonly businessHours: IBusinessHours;
  readonly verificationStatus: IVerificationStatus;
  readonly owner: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Activity tracking (computed from orders/offers/owner)
  readonly lastOrderAt?: Date;
  readonly lastOfferCreatedAt?: Date;
  readonly ownerLastLoginAt?: Date;
  readonly lastActivityAt?: Date;
  // Trial / subscription lifecycle
  readonly subscriptionStatus: 'trial' | 'paid' | 'suspended';
  readonly trialEndsAt?: Date;
}

export interface IEstablishmentAddress {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export interface IBusinessHours {
  readonly monday: ITimeSlot;
  readonly tuesday: ITimeSlot;
  readonly wednesday: ITimeSlot;
  readonly thursday: ITimeSlot;
  readonly friday: ITimeSlot;
  readonly saturday: ITimeSlot;
  readonly sunday: ITimeSlot;
}

export interface ITimeSlot {
  readonly open: string;
  readonly close: string;
  readonly isClosed: boolean;
}

export interface IVerificationStatus {
  readonly documentsVerified: boolean;
  readonly identityVerified: boolean;
  readonly addressVerified: boolean;
  readonly verifiedAt?: Date;
  readonly verifiedBy?: string;
}

export interface IEstablishmentStats {
  readonly totalOrders: number;
  readonly totalRevenue: number;
  readonly averageRating: number;
  readonly totalOffers: number;
  readonly activeOffers: number;
  readonly completionRate: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface IEstablishmentOverview {
  readonly total: number;
  readonly pending: number;
  readonly active: number;
  readonly suspended: number;
  readonly rejected: number;
  readonly recentApprovals: number;
  readonly avgApprovalTime: number;
  readonly activeLastThirtyDays: number;
}

export interface IEstablishmentListResponse {
  readonly establishments: IEstablishment[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}
