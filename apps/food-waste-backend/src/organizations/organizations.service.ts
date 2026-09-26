import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrganizationStatus } from '@foodwaste/shared';

import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

import { appError } from '../common/errors';
export interface OrganizationLean {
  _id: unknown;
  name: string;
  logo?: string;
  ownerId: Types.ObjectId;
  status: OrganizationStatus;
  establishmentIds: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FindAllOrganizationsResult {
  organizations: OrganizationDocument[];
  total: number;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    @InjectModel('User')
    private readonly userModel: Model<{
      status: string;
      role: string;
      assignedEstablishmentId?: string;
    }>,
  ) {}

  /**
   * Create a new organization for a merchant.
   * One organization per owner (enforced by unique index on ownerId).
   */
  async create(
    dto: CreateOrganizationDto,
    ownerId: string,
    firstEstablishmentId: string,
  ): Promise<OrganizationDocument> {
    const existing = await this.organizationModel
      .findOne({ ownerId: new Types.ObjectId(ownerId), isDeleted: false })
      .exec();

    if (existing) {
      throw new ConflictException(appError('ORGANIZATION_LIMIT_REACHED'));
    }

    const org = new this.organizationModel({
      name: dto.name,
      ownerId: new Types.ObjectId(ownerId),
      establishmentIds: [new Types.ObjectId(firstEstablishmentId)],
      status: OrganizationStatus.PENDING,
    });

    const saved = await org.save();
    this.logger.log(`Organization created: ${saved._id} for owner ${ownerId}`);
    return saved;
  }

  /**
   * Find organization by ID, excluding soft-deleted ones.
   */
  async findById(id: string): Promise<OrganizationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(appError('INVALID_ID'));
    }

    const org = await this.organizationModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .exec();

    if (!org) {
      throw new NotFoundException(appError('ORGANIZATION_NOT_FOUND'));
    }

    return org;
  }

  /**
   * Find organization by owner ID. Returns null if none found.
   */
  async findByOwnerId(ownerId: string): Promise<OrganizationDocument | null> {
    const result = await this.organizationModel
      .findOne({ ownerId: new Types.ObjectId(ownerId), isDeleted: false })
      .exec();
    return result;
  }

  /**
   * Find the organization that contains a given establishment ID.
   */
  async findByEstablishmentId(establishmentId: string): Promise<OrganizationDocument | null> {
    if (!Types.ObjectId.isValid(establishmentId)) {
      return null;
    }

    const result = await this.organizationModel
      .findOne({
        establishmentIds: new Types.ObjectId(establishmentId),
        isDeleted: false,
      })
      .exec();
    return result;
  }

  /**
   * Update organization name (owner only).
   */
  async update(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(id);

    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(appError('ORGANIZATION_OWNER_ONLY'));
    }

    Object.assign(org, dto);
    const saved = await org.save();
    this.logger.log(`Organization updated: ${id} by user ${userId}`);
    return saved;
  }

  /**
   * Add an establishment to the organization (owner only, no duplicates).
   */
  async addEstablishment(
    orgId: string,
    establishmentId: string,
    userId: string,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(orgId);

    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(appError('ORGANIZATION_OWNER_ONLY'));
    }

    const estabObjId = new Types.ObjectId(establishmentId);
    const alreadyLinked = org.establishmentIds.some(id => id.toString() === establishmentId);

    if (alreadyLinked) {
      throw new ConflictException(appError('ORGANIZATION_ESTABLISHMENT_EXISTS'));
    }

    org.establishmentIds.push(estabObjId);
    const saved = await org.save();
    this.logger.log(`Establishment ${establishmentId} added to organization ${orgId}`);
    return saved;
  }

  /**
   * Remove an establishment from the organization (owner only).
   * Must keep at least 1 establishment.
   * CASCADE: suspends any LOCATION_MANAGER users assigned to the removed establishment.
   */
  async removeEstablishment(
    orgId: string,
    establishmentId: string,
    userId: string,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(orgId);

    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(appError('ORGANIZATION_OWNER_ONLY'));
    }

    const idx = org.establishmentIds.findIndex(id => id.toString() === establishmentId);

    if (idx === -1) {
      throw new NotFoundException(appError('ORGANIZATION_ESTABLISHMENT_NOT_FOUND'));
    }

    if (org.establishmentIds.length <= 1) {
      throw new BadRequestException(appError('ORGANIZATION_LAST_ESTABLISHMENT'));
    }

    org.establishmentIds.splice(idx, 1);
    await org.save();

    // CASCADE: suspend location managers assigned to the removed establishment
    try {
      const suspendResult = await this.userModel.updateMany(
        {
          role: 'location_manager',
          assignedEstablishmentId: establishmentId,
          status: { $ne: 'suspended' },
        },
        { $set: { status: 'suspended' } },
      );
      if (suspendResult.modifiedCount > 0) {
        this.logger.log(
          `Suspended ${suspendResult.modifiedCount} location manager(s) after removing establishment ${establishmentId}`,
        );
      }
    } catch (error) {
      // Log but don't fail the primary operation
      this.logger.error(
        `Failed to cascade-suspend location managers for establishment ${establishmentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    this.logger.log(`Establishment ${establishmentId} removed from organization ${orgId}`);
    return org;
  }

  /**
   * Update organization status (admin only — called from controller with role check).
   */
  async updateStatus(id: string, status: OrganizationStatus): Promise<OrganizationDocument> {
    const org = await this.findById(id);
    org.status = status;
    const saved = await org.save();
    this.logger.log(`Organization ${id} status updated to ${status}`);
    return saved;
  }

  /**
   * Admin: list all organizations with optional status filter and pagination.
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: OrganizationStatus,
  ): Promise<FindAllOrganizationsResult> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const filter: Record<string, unknown> = { isDeleted: false };
    if (status) {
      filter['status'] = status;
    }

    const [organizations, total] = await Promise.all([
      this.organizationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.organizationModel.countDocuments(filter),
    ]);

    return { organizations, total };
  }
}
