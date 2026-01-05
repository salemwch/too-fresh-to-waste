import { IEstablishment, IEstablishmentStats, IEstablishmentOverview, IEstablishmentListResponse } from '../../common/interfaces/establishment.interface';
import { ApproveEstablishmentDto, UpdateEstablishmentStatusDto, EstablishmentSearchDto, EstablishmentStatsDto } from '../dto/establishment-management.dto';
import { AdminAuditLogDocument } from '../schemas/admin-audit-log.schema';
import { LeanDocument } from '../../common/types/mongoose.types';

export interface IEstablishmentManagementService {
  getEstablishmentOverview(): Promise<IEstablishmentOverview>;

  getPendingApprovals(limit?: number): Promise<IEstablishment[]>;

  searchEstablishments(query: EstablishmentSearchDto): Promise<IEstablishmentListResponse>;

  getEstablishmentById(establishmentId: string): Promise<IEstablishment>;

  approveEstablishment(
    establishmentId: string,
    approveDto: ApproveEstablishmentDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<IEstablishment>;

  updateEstablishmentStatus(
    establishmentId: string,
    updateDto: UpdateEstablishmentStatusDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<IEstablishment>;

  getEstablishmentStats(
    establishmentId: string,
    statsDto: EstablishmentStatsDto
  ): Promise<IEstablishmentStats>;

  getEstablishmentActivity(
    establishmentId: string,
    days?: number
  ): Promise<LeanDocument<AdminAuditLogDocument>[]>;

  verifyEstablishmentDocuments(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<IEstablishment>;
}

export const ESTABLISHMENT_MANAGEMENT_SERVICE = Symbol('IEstablishmentManagementService');