import { IEstablishment, IEstablishmentOverview, IEstablishmentStats, IEstablishmentListResponse } from '../interfaces/establishment.interface';

export class EstablishmentMapper {
  static toInterface(document: any): IEstablishment {
    if (!document) {
      throw new Error('Document cannot be null or undefined');
    }

    return {
      id: document._id?.toString() || document.id,
      name: document.name,
      description: document.description,
      email: document.email,
      phone: document.phone || document.contactInfo?.phone || '',
      type: document.type,
      status: document.status,
      address: {
        street: document.address?.street || '',
        city: document.address?.city || '',
        state: document.address?.state || '',
        postalCode: document.address?.postalCode || '',
        country: document.address?.country || '',
        coordinates: {
          latitude: document.address?.coordinates?.latitude || 0,
          longitude: document.address?.coordinates?.longitude || 0,
        },
      },
      businessHours: document.businessHours || {
        monday: { open: '09:00', close: '17:00', isClosed: false },
        tuesday: { open: '09:00', close: '17:00', isClosed: false },
        wednesday: { open: '09:00', close: '17:00', isClosed: false },
        thursday: { open: '09:00', close: '17:00', isClosed: false },
        friday: { open: '09:00', close: '17:00', isClosed: false },
        saturday: { open: '09:00', close: '17:00', isClosed: false },
        sunday: { open: '09:00', close: '17:00', isClosed: true },
      },
      verificationStatus: {
        documentsVerified: document.verification?.documentsVerified || false,
        identityVerified: document.verification?.identityVerified || false,
        addressVerified: document.verification?.addressVerified || false,
        verifiedAt: document.verification?.verifiedAt,
        verifiedBy: document.verification?.verifiedBy,
      },
      owner: document.owner?.toString() || document.ownerId?.toString() || '',
      createdAt: document.createdAt || new Date(),
      updatedAt: document.updatedAt || new Date(),
    };
  }

  static toInterfaceArray(documents: any[]): IEstablishment[] {
    return documents.map(doc => this.toInterface(doc));
  }

  static toOverviewInterface(data: any): IEstablishmentOverview {
    return {
      total: data.total || 0,
      pending: data.pending || 0,
      active: data.active || 0,
      suspended: data.suspended || 0,
      rejected: data.rejected || 0,
      recentApprovals: data.recentApprovals || 0,
      avgApprovalTime: data.avgApprovalTime || 0,
    };
  }

  static toStatsInterface(data: any): IEstablishmentStats {
    return {
      totalOrders: data.totalOrders || 0,
      totalRevenue: data.totalRevenue || 0,
      averageRating: data.averageRating || 0,
      totalOffers: data.totalOffers || 0,
      activeOffers: data.activeOffers || 0,
      completionRate: data.completionRate || 0,
      periodStart: data.periodStart || new Date(),
      periodEnd: data.periodEnd || new Date(),
    };
  }

  static toListResponse(data: any): IEstablishmentListResponse {
    return {
      establishments: this.toInterfaceArray(data.establishments || []),
      total: data.total || 0,
      page: data.page || 1,
      limit: data.limit || 20,
      totalPages: data.totalPages || 0,
    };
  }
}