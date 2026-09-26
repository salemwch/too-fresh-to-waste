import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, isValidObjectId } from 'mongoose';

import { Offer, OfferDocument, OfferStatus } from '../../offers/schemas/offer.schema';
import {
  AdminOfferQueryDto,
  AdminOfferDeletedQueryDto,
  BulkOfferAction,
  BulkOfferActionDto,
  LowPickupRateQueryDto,
  PriceViolationQueryDto,
  ExportOffersQueryDto,
} from '../dto/admin-offer-query.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';
import { AdminAuditService } from './admin-audit.service';

import { appError } from '../../common/errors';
// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface OfferStats {
  countByStatus: Record<string, number>;
  totalOffers: number;
  totalActiveBags: number;
  totalSoldBags: number;
  totalRevenueSaved: number;
  avgDiscountPercentage: number;
  platformPickupRate: number;
  featuredCount: number;
  topCategories: Array<{ category: string; count: number }>;
  offersByType: Record<string, number>;
}

interface CreateAuditParams {
  adminId: string;
  adminEmail: string;
  ipAddress: string;
  userAgent: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class OfferManagementService {
  private readonly logger = new Logger(OfferManagementService.name);

  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    private readonly auditService: AdminAuditService,
  ) {}

  // ── Find Single Offer ──────────────────────────────────────────────────────

  async findById(id: string): Promise<Record<string, unknown>> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(appError('INVALID_ID'));
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
          pipeline: [{ $project: { name: 1, type: 1, city: 1, status: 1 } }],
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          id: { $toString: '$_id' },
          availableQuantity: {
            $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }],
          },
          pickupRate: {
            $cond: [
              { $gt: ['$totalQuantity', 0] },
              { $divide: ['$soldQuantity', '$totalQuantity'] },
              0,
            ],
          },
          isFeatured: { $or: ['$isFeaturedManual', '$isFeaturedAuto'] },
        },
      },
    ];

    const results = await this.offerModel.aggregate(pipeline).exec();
    const offer = results[0] as Record<string, unknown> | undefined;

    if (!offer) {
      throw new NotFoundException(appError('OFFER_NOT_FOUND'));
    }

    return offer;
  }

  // ── List All Offers ────────────────────────────────────────────────────────

  async listOffers(
    query: AdminOfferQueryDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Explicitly exclude deleted — the pre-aggregate middleware adds this,
    // but we include it here so the intent is clear.
    const match: Record<string, unknown> = { isDeleted: { $ne: true } };

    if (query.status) {
      match['status'] = query.status;
    }
    if (query.type) {
      match['type'] = query.type;
    }
    if (query.establishmentId) {
      if (!isValidObjectId(query.establishmentId)) {
        throw new BadRequestException(appError('INVALID_ID'));
      }
      match['establishmentId'] = new Types.ObjectId(query.establishmentId);
    }
    if (query.merchantId) {
      if (!isValidObjectId(query.merchantId)) {
        throw new BadRequestException(appError('INVALID_ID'));
      }
      match['merchantId'] = new Types.ObjectId(query.merchantId);
    }
    if (query.featured === true) {
      match['$or'] = [{ isFeaturedManual: true }, { isFeaturedAuto: true }];
    } else if (query.featured === false) {
      match['isFeaturedManual'] = false;
      match['isFeaturedAuto'] = false;
    }
    if (query.minDiscount !== undefined || query.maxDiscount !== undefined) {
      const discountRange: Record<string, number> = {};
      if (query.minDiscount !== undefined) {
        discountRange['$gte'] = query.minDiscount;
      }
      if (query.maxDiscount !== undefined) {
        discountRange['$lte'] = query.maxDiscount;
      }
      match['pricing.discountPercentage'] = discountRange;
    }
    if (query.dateFrom || query.dateTo) {
      const dateRange: Record<string, Date> = {};
      if (query.dateFrom) {
        dateRange['$gte'] = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        dateRange['$lte'] = new Date(query.dateTo);
      }
      match['createdAt'] = dateRange;
    }
    if (query.search) {
      match['$text'] = { $search: query.search };
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
          pipeline: [{ $project: { name: 1, type: 1, city: 1, status: 1 } }],
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          availableQuantity: {
            $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }],
          },
          pickupRate: {
            $cond: [
              { $gt: ['$totalQuantity', 0] },
              { $divide: ['$soldQuantity', '$totalQuantity'] },
              0,
            ],
          },
          isFeatured: { $or: ['$isFeaturedManual', '$isFeaturedAuto'] },
        },
      },
      {
        $project: {
          title: 1,
          status: 1,
          type: 1,
          'pricing.originalPrice': 1,
          'pricing.discountedPrice': 1,
          'pricing.discountPercentage': 1,
          totalQuantity: 1,
          soldQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          pickupRate: 1,
          categories: 1,
          isActive: 1,
          isFeaturedManual: 1,
          isFeaturedAuto: 1,
          isFeatured: 1,
          availableFrom: 1,
          availableUntil: 1,
          viewCount: 1,
          favoriteCount: 1,
          createdAt: 1,
          publishedAt: 1,
          expiredAt: 1,
          establishment: 1,
          merchant: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.offerModel.aggregate(pipeline);
    const total = (result?.total?.[0]?.count as number | undefined) ?? 0;

    return {
      data: (result?.data as Record<string, unknown>[]) ?? [],
      total,
      page,
      limit,
    };
  }

  // ── Platform Stats ─────────────────────────────────────────────────────────

  async getStats(): Promise<OfferStats> {
    const pipeline: PipelineStage[] = [
      { $match: { isDeleted: { $ne: true } } },
      {
        $facet: {
          countByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          totals: [
            {
              $group: {
                _id: null,
                totalSoldBags: { $sum: '$soldQuantity' },
                totalRevenueSaved: {
                  $sum: { $multiply: ['$soldQuantity', '$pricing.discountedPrice'] },
                },
                avgDiscount: { $avg: '$pricing.discountPercentage' },
                totalActiveBags: {
                  $sum: {
                    $cond: [
                      { $eq: ['$status', OfferStatus.ACTIVE] },
                      {
                        $subtract: [
                          '$totalQuantity',
                          { $add: ['$reservedQuantity', '$soldQuantity'] },
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
            },
          ],
          pickupRateBase: [
            {
              $match: { status: { $in: [OfferStatus.EXPIRED, OfferStatus.SOLD_OUT] } },
            },
            {
              $group: {
                _id: null,
                totalQuantity: { $sum: '$totalQuantity' },
                totalSold: { $sum: '$soldQuantity' },
              },
            },
          ],
          featuredCount: [
            {
              $match: { $or: [{ isFeaturedManual: true }, { isFeaturedAuto: true }] },
            },
            { $count: 'count' },
          ],
          topCategories: [
            { $unwind: '$categories' },
            { $group: { _id: '$categories', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          offersByType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
        },
      },
    ];

    const [result] = await this.offerModel.aggregate(pipeline);

    const countByStatus = Object.fromEntries(
      ((result.countByStatus as Array<{ _id: string; count: number }>) ?? []).map(s => [
        s._id,
        s.count,
      ]),
    );
    const totals = (result.totals as Array<Record<string, number>>)?.[0] ?? {};
    const pickupBase = (result.pickupRateBase as Array<Record<string, number>>)?.[0];
    const pickupTotalQty = pickupBase?.['totalQuantity'] ?? 0;
    const pickupTotalSold = pickupBase?.['totalSold'] ?? 0;
    const pickupRate = pickupTotalQty > 0 ? pickupTotalSold / pickupTotalQty : 0;

    return {
      countByStatus,
      totalOffers: Object.values(countByStatus).reduce((a, b) => a + b, 0),
      totalActiveBags: totals['totalActiveBags'] ?? 0,
      totalSoldBags: totals['totalSoldBags'] ?? 0,
      totalRevenueSaved: Math.round((totals['totalRevenueSaved'] ?? 0) * 100) / 100,
      avgDiscountPercentage: Math.round((totals['avgDiscount'] ?? 0) * 10) / 10,
      platformPickupRate: Math.round(pickupRate * 1000) / 1000,
      featuredCount: (result.featuredCount as Array<{ count: number }>)?.[0]?.count ?? 0,
      topCategories: ((result.topCategories as Array<{ _id: string; count: number }>) ?? []).map(
        c => ({ category: c._id, count: c.count }),
      ),
      offersByType: Object.fromEntries(
        ((result.offersByType as Array<{ _id: string; count: number }>) ?? []).map(t => [
          t._id,
          t.count,
        ]),
      ),
    };
  }

  // ── Low Pickup Rate ────────────────────────────────────────────────────────

  async getLowPickupRate(
    query: LowPickupRateQueryDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const threshold = query.threshold ?? 0.2;
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $in: [OfferStatus.EXPIRED, OfferStatus.SOLD_OUT] },
          totalQuantity: { $gt: 0 },
        },
      },
      {
        $addFields: {
          pickupRate: { $divide: ['$soldQuantity', '$totalQuantity'] },
        },
      },
      { $match: { pickupRate: { $lt: threshold } } },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
          pipeline: [{ $project: { name: 1, type: 1 } }],
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          status: 1,
          'pricing.discountPercentage': 1,
          'pricing.discountedPrice': 1,
          totalQuantity: 1,
          soldQuantity: 1,
          pickupRate: 1,
          categories: 1,
          availableFrom: 1,
          availableUntil: 1,
          expiredAt: 1,
          establishment: 1,
        },
      },
      { $sort: { pickupRate: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.offerModel.aggregate(pipeline);
    return {
      data: (result?.data as Record<string, unknown>[]) ?? [],
      total: (result?.total?.[0]?.count as number | undefined) ?? 0,
    };
  }

  // ── Price Violations ───────────────────────────────────────────────────────

  async getPriceViolations(
    query: PriceViolationQueryDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const minDiscount = query.minDiscount ?? 30;
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $in: [OfferStatus.ACTIVE, OfferStatus.DRAFT] },
          'pricing.discountPercentage': { $lt: minDiscount },
        },
      },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
          pipeline: [{ $project: { name: 1, type: 1 } }],
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          status: 1,
          'pricing.originalPrice': 1,
          'pricing.discountedPrice': 1,
          'pricing.discountPercentage': 1,
          availableFrom: 1,
          availableUntil: 1,
          createdAt: 1,
          establishment: 1,
          merchant: 1,
        },
      },
      { $sort: { 'pricing.discountPercentage': 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.offerModel.aggregate(pipeline);
    return {
      data: (result?.data as Record<string, unknown>[]) ?? [],
      total: (result?.total?.[0]?.count as number | undefined) ?? 0,
    };
  }

  // ── Bulk Action ────────────────────────────────────────────────────────────

  async bulkAction(
    dto: BulkOfferActionDto,
    audit: CreateAuditParams,
  ): Promise<{ processed: number; failed: string[]; action: BulkOfferAction }> {
    if (dto.action === 'delete' && !dto.reason) {
      throw new BadRequestException(appError('REASON_REQUIRED'));
    }

    const objectIds = dto.offerIds.map(id => new Types.ObjectId(id));
    const failed: string[] = [];
    let processed = 0;

    if (dto.action === 'delete') {
      const offersWithReservations = await this.offerModel
        .find({ _id: { $in: objectIds }, reservedQuantity: { $gt: 0 } })
        .select('_id')
        .lean();
      const blockedIds = new Set(offersWithReservations.map(o => String(o._id)));

      dto.offerIds.forEach(id => {
        if (blockedIds.has(id)) {
          failed.push(id);
        }
      });

      const safeIds = objectIds.filter(id => !blockedIds.has(id.toString()));
      if (safeIds.length > 0) {
        const result = await this.offerModel.updateMany(
          { _id: { $in: safeIds } },
          {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: audit.adminId,
            deletionReason: dto.reason ?? 'Admin bulk deletion',
            status: OfferStatus.CANCELLED,
            isActive: false,
          },
        );
        processed = result.modifiedCount;
      }
    } else {
      const update = this.buildBulkUpdate(dto.action);
      const result = await this.offerModel.updateMany(
        { _id: { $in: objectIds } },
        { $set: update },
      );
      processed = result.modifiedCount;
    }

    await this.auditService.createAuditLog({
      adminId: audit.adminId,
      adminEmail: audit.adminEmail,
      action: AdminAction.BULK_OPERATION,
      targetType: 'offer',
      reason: dto.reason,
      newValue: {
        action: dto.action,
        offerCount: String(processed),
        offerIds: dto.offerIds.join(','),
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    this.logger.log(
      `Admin bulk action "${dto.action}" on ${processed} offers by ${audit.adminEmail}`,
    );

    return { processed, failed, action: dto.action };
  }

  private buildBulkUpdate(action: BulkOfferAction): Record<string, unknown> {
    switch (action) {
      case 'disable':
        return { isActive: false };
      case 'enable':
        return { isActive: true };
      case 'feature':
        return { isFeaturedManual: true, featuredAt: new Date() };
      case 'unfeature':
        return { isFeaturedManual: false, isFeaturedAuto: false };
      default:
        throw new BadRequestException(
          appError('UNKNOWN_BULK_ACTION', { action: String(action as string) }),
        );
    }
  }

  // ── Deleted Offers ─────────────────────────────────────────────────────────

  async getDeletedOffers(
    query: AdminOfferDeletedQueryDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const match: Record<string, unknown> = { isDeleted: true };

    if (query.deletedBy) {
      if (!isValidObjectId(query.deletedBy)) {
        throw new BadRequestException(appError('INVALID_ID'));
      }
      match['deletedBy'] = query.deletedBy;
    }
    if (query.dateFrom || query.dateTo) {
      const range: Record<string, Date> = {};
      if (query.dateFrom) {
        range['$gte'] = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        range['$lte'] = new Date(query.dateTo);
      }
      match['deletedAt'] = range;
    }

    // Use find() with setOptions to bypass the pre-find soft-delete middleware
    const [data, total] = await Promise.all([
      this.offerModel
        .find(match)
        .setOptions({ includeDeleted: true } as Record<string, unknown>)
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'title status pricing.discountedPrice pricing.discountPercentage totalQuantity soldQuantity deletedAt deletedBy deletionReason establishmentId createdAt',
        )
        .populate('establishmentId', 'name')
        .lean(),
      this.offerModel
        .countDocuments(match)
        .setOptions({ includeDeleted: true } as Record<string, unknown>),
    ]);

    return { data: data as unknown as Record<string, unknown>[], total };
  }

  // ── Restore Offer ──────────────────────────────────────────────────────────

  async restoreOffer(offerId: string, audit: CreateAuditParams): Promise<Record<string, unknown>> {
    if (!isValidObjectId(offerId)) {
      throw new BadRequestException(appError('INVALID_ID'));
    }

    const offer = await this.offerModel
      .findOne({ _id: offerId, isDeleted: true })
      .setOptions({ includeDeleted: true } as Record<string, unknown>)
      .lean();

    if (!offer) {
      throw new NotFoundException(appError('DELETED_OFFER_NOT_FOUND'));
    }

    const restored = await this.offerModel
      .findByIdAndUpdate(
        offerId,
        {
          isDeleted: false,
          $unset: { deletedAt: '', deletedBy: '', deletionReason: '' },
          status: OfferStatus.DRAFT,
          isActive: false,
        },
        { new: true },
      )
      .setOptions({ includeDeleted: true } as Record<string, unknown>)
      .lean();

    await this.auditService.createAuditLog({
      adminId: audit.adminId,
      adminEmail: audit.adminEmail,
      action: AdminAction.OFFER_RESTORED,
      targetType: 'offer',
      targetId: offerId,
      reason: 'Admin restore from deletion',
      previousValue: { isDeleted: 'true', status: String(offer.status) },
      newValue: { isDeleted: 'false', status: OfferStatus.DRAFT },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    this.logger.log(`Offer ${offerId} restored by admin ${audit.adminEmail}`);
    return restored as Record<string, unknown>;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async exportOffers(
    query: ExportOffersQueryDto,
    audit: CreateAuditParams,
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const firstPage = await this.listOffers({ ...query, page: 1, limit: 100 });
    let allData = [...firstPage.data];

    if (firstPage.total > 100) {
      const pages = Math.min(Math.ceil(firstPage.total / 100), 50); // cap at 5 000
      for (let p = 2; p <= pages; p++) {
        const page = await this.listOffers({ ...query, page: p, limit: 100 });
        allData = allData.concat(page.data);
      }
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    await this.auditService.createAuditLog({
      adminId: audit.adminId,
      adminEmail: audit.adminEmail,
      action: AdminAction.DATA_EXPORT,
      targetType: 'offer',
      newValue: { exportedCount: String(allData.length), format: query.format ?? 'json' },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    if (query.format === 'csv') {
      return {
        data: this.toCsv(allData),
        filename: `offers-export-${timestamp}.csv`,
        contentType: 'text/csv',
      };
    }

    return {
      data: JSON.stringify(allData, null, 2),
      filename: `offers-export-${timestamp}.json`,
      contentType: 'application/json',
    };
  }

  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return '';
    }

    const flatRow = (obj: Record<string, unknown>, prefix = ''): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(out, flatRow(value as Record<string, unknown>, fullKey));
        } else {
          out[fullKey] = Array.isArray(value) ? value.join(';') : String(value ?? '');
        }
      }
      return out;
    };

    const flatRows = rows.map(r => flatRow(r));
    const headers = [...new Set(flatRows.flatMap(Object.keys))];
    const csvLines = [
      headers.join(','),
      ...flatRows.map(row => headers.map(h => `"${(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    return csvLines.join('\n');
  }
}
