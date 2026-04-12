import { EstablishmentType, EstablishmentStatus } from '../interfaces/establishment.interface';

import type {
  IEstablishment,
  IEstablishmentOverview,
  IEstablishmentStats,
  IEstablishmentListResponse,
} from '../interfaces/establishment.interface';

interface EstablishmentLike {
  _id?: { toString(): string };
  id?: string;
  name?: string;
  description?: string;
  email?: string;
  phone?: string;
  contactInfo?: { phone?: string };
  type?: IEstablishment['type'];
  status?: IEstablishment['status'];
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
  businessHours?: IEstablishment['businessHours'];
  verification?: {
    documentsVerified?: boolean;
    identityVerified?: boolean;
    addressVerified?: boolean;
    verifiedAt?: Date;
    verifiedBy?: string;
  };
  owner?: { toString(): string };
  ownerId?: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
  // Activity fields computed by admin aggregation pipeline
  lastOrderAt?: Date;
  lastOfferCreatedAt?: Date;
  ownerLastLoginAt?: Date;
  lastActivityAt?: Date;
  subscriptionStatus?: 'trial' | 'paid' | 'suspended';
  trialEndsAt?: Date;
}

interface OverviewLike {
  total?: number;
  pending?: number;
  active?: number;
  suspended?: number;
  rejected?: number;
  recentApprovals?: number;
  avgApprovalTime?: number;
  activeLastThirtyDays?: number;
}

interface StatsLike {
  totalOrders?: number;
  totalRevenue?: number;
  averageRating?: number;
  totalOffers?: number;
  activeOffers?: number;
  completionRate?: number;
  periodStart?: Date;
  periodEnd?: Date;
}

interface ListResponseLike {
  establishments?: EstablishmentLike[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export class EstablishmentMapper {
  static toInterface(document: EstablishmentLike | null | undefined): IEstablishment {
    if (document === null || document === undefined) {
      throw new Error('Document cannot be null or undefined');
    }

    return {
      id: document._id?.toString() ?? document.id ?? '',
      name: document.name ?? '',
      description: document.description ?? '',
      email: document.email ?? '',
      phone: document.phone ?? document.contactInfo?.phone ?? '',
      type: document.type ?? EstablishmentType.OTHER,
      status: document.status ?? EstablishmentStatus.PENDING,
      address: {
        street: document.address?.street ?? '',
        city: document.address?.city ?? '',
        state: document.address?.state ?? '',
        postalCode: document.address?.postalCode ?? '',
        country: document.address?.country ?? '',
        coordinates: {
          latitude: document.address?.coordinates?.latitude ?? 0,
          longitude: document.address?.coordinates?.longitude ?? 0,
        },
      },
      businessHours: document.businessHours ?? {
        monday: { open: '09:00', close: '17:00', isClosed: false },
        tuesday: { open: '09:00', close: '17:00', isClosed: false },
        wednesday: { open: '09:00', close: '17:00', isClosed: false },
        thursday: { open: '09:00', close: '17:00', isClosed: false },
        friday: { open: '09:00', close: '17:00', isClosed: false },
        saturday: { open: '09:00', close: '17:00', isClosed: false },
        sunday: { open: '09:00', close: '17:00', isClosed: true },
      },
      verificationStatus: {
        documentsVerified: document.verification?.documentsVerified ?? false,
        identityVerified: document.verification?.identityVerified ?? false,
        addressVerified: document.verification?.addressVerified ?? false,
        ...(document.verification?.verifiedAt !== undefined
          ? { verifiedAt: document.verification.verifiedAt }
          : {}),
        ...(document.verification?.verifiedBy !== undefined
          ? { verifiedBy: document.verification.verifiedBy }
          : {}),
      },
      owner: document.owner?.toString() ?? document.ownerId?.toString() ?? '',
      createdAt: document.createdAt ?? new Date(),
      updatedAt: document.updatedAt ?? new Date(),
      ...(document.lastOrderAt !== undefined ? { lastOrderAt: document.lastOrderAt } : {}),
      ...(document.lastOfferCreatedAt !== undefined
        ? { lastOfferCreatedAt: document.lastOfferCreatedAt }
        : {}),
      ...(document.ownerLastLoginAt !== undefined
        ? { ownerLastLoginAt: document.ownerLastLoginAt }
        : {}),
      ...(document.lastActivityAt !== undefined ? { lastActivityAt: document.lastActivityAt } : {}),
      subscriptionStatus: document.subscriptionStatus ?? 'trial',
      ...(document.trialEndsAt !== undefined ? { trialEndsAt: document.trialEndsAt } : {}),
    };
  }

  static toInterfaceArray(documents: EstablishmentLike[]): IEstablishment[] {
    return documents.map(doc => this.toInterface(doc));
  }

  static toOverviewInterface(data: OverviewLike): IEstablishmentOverview {
    return {
      total: data.total ?? 0,
      pending: data.pending ?? 0,
      active: data.active ?? 0,
      suspended: data.suspended ?? 0,
      rejected: data.rejected ?? 0,
      recentApprovals: data.recentApprovals ?? 0,
      avgApprovalTime: data.avgApprovalTime ?? 0,
      activeLastThirtyDays: data.activeLastThirtyDays ?? 0,
    };
  }

  static toStatsInterface(data: StatsLike): IEstablishmentStats {
    return {
      totalOrders: data.totalOrders ?? 0,
      totalRevenue: data.totalRevenue ?? 0,
      averageRating: data.averageRating ?? 0,
      totalOffers: data.totalOffers ?? 0,
      activeOffers: data.activeOffers ?? 0,
      completionRate: data.completionRate ?? 0,
      periodStart: data.periodStart ?? new Date(),
      periodEnd: data.periodEnd ?? new Date(),
    };
  }

  static toListResponse(data: ListResponseLike): IEstablishmentListResponse {
    return {
      establishments: this.toInterfaceArray(data.establishments ?? []),
      total: data.total ?? 0,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
      totalPages: data.totalPages ?? 0,
    };
  }
}
