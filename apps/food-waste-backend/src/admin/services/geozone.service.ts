import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { Geozone, GeozoneDocument } from '../schemas/geozone.schema';
import { CreateGeozoneDto, UpdateGeozoneDto, GeozoneSearchDto } from '../dto/geozone.dto';

@Injectable()
export class GeozoneService {
  constructor(
    @InjectModel(Geozone.name) private readonly model: Model<GeozoneDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {}

  async list(query: GeozoneSearchDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['status'] = query.status;
    }

    if (query.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(query.search);
      filter['$or'] = [
        { name: { $regex: escaped, $options: 'i' } },
        { displayName: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getById(id: string) {
    const item = await this.model.findById(id).lean();
    if (!item) {
      throw new NotFoundException('Geozone not found');
    }
    return item;
  }

  async create(dto: CreateGeozoneDto) {
    const existing = await this.model.findOne({ name: dto.name }).lean();
    if (existing) {
      throw new ConflictException('A zone with this name already exists');
    }

    const closed = [...dto.polygonCoordinates];
    if (
      closed.length > 0 &&
      (closed[0]![0] !== closed[closed.length - 1]![0] ||
        closed[0]![1] !== closed[closed.length - 1]![1])
    ) {
      closed.push(closed[0]!);
    }

    const zone = await this.model.create({
      name: dto.name,
      displayName: dto.displayName,
      ...(dto.description ? { description: dto.description } : {}),
      boundary: { type: 'Polygon', coordinates: [closed] },
      center: dto.center,
      ...(dto.deliveryFee !== undefined ? { deliveryFee: dto.deliveryFee } : {}),
      ...(dto.minimumOrder !== undefined ? { minimumOrder: dto.minimumOrder } : {}),
      ...(dto.defaultSearchRadius !== undefined
        ? { defaultSearchRadius: dto.defaultSearchRadius }
        : {}),
    });

    return zone.toObject();
  }

  async update(id: string, dto: UpdateGeozoneDto) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException('Geozone not found');
    }

    if (dto.displayName !== undefined) {
      item.displayName = dto.displayName;
    }
    if (dto.description !== undefined) {
      item.description = dto.description;
    }
    if (dto.status !== undefined) {
      item.status = dto.status;
    }
    if (dto.deliveryFee !== undefined) {
      item.deliveryFee = dto.deliveryFee;
    }
    if (dto.minimumOrder !== undefined) {
      item.minimumOrder = dto.minimumOrder;
    }
    if (dto.defaultSearchRadius !== undefined) {
      item.defaultSearchRadius = dto.defaultSearchRadius;
    }
    if (dto.center !== undefined) {
      item.center = dto.center;
    }

    if (dto.polygonCoordinates) {
      const closed = [...dto.polygonCoordinates];
      if (
        closed.length > 0 &&
        (closed[0]![0] !== closed[closed.length - 1]![0] ||
          closed[0]![1] !== closed[closed.length - 1]![1])
      ) {
        closed.push(closed[0]!);
      }
      item.boundary = { type: 'Polygon', coordinates: [closed] };
    }

    return item.save();
  }

  async remove(id: string) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException('Geozone not found');
    }
    await item.deleteOne();
  }

  async getStats() {
    const zones = await this.model.find().lean();

    const enriched = await Promise.all(
      zones.map(async zone => {
        // `address.coordinates`, not `location.coordinates`. Establishments have
        // no `location` field at all - that path belongs to SearchQuery, which
        // is a different collection. Querying it here matched nothing, so every
        // zone reported establishmentCount: 0 on the admin geozones page, which
        // read as "no merchants have signed up" rather than as a broken query.
        // The 2dsphere index backing this lives on `address.coordinates`
        // (establishment.schema.ts).
        const estCount = await this.establishmentModel.countDocuments({
          'address.coordinates': {
            $geoWithin: { $geometry: zone.boundary },
          },
        });
        return {
          _id: zone._id,
          name: zone.name,
          displayName: zone.displayName,
          status: zone.status,
          center: zone.center,
          establishmentCount: estCount,
        };
      }),
    );

    return {
      totalZones: zones.length,
      activeZones: zones.filter(z => z.status === 'active').length,
      zones: enriched,
    };
  }
}
