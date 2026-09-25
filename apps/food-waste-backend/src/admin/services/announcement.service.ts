import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import {
  Announcement,
  AnnouncementDocument,
  AnnouncementStatus,
} from '../schemas/announcement.schema';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementSearchDto,
} from '../dto/announcement.dto';

import { appError } from '../../common/errors';
@Injectable()
export class AnnouncementService {
  constructor(
    @InjectModel(Announcement.name) private readonly model: Model<AnnouncementDocument>,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {}

  async list(query: AnnouncementSearchDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.type) {
      filter['type'] = query.type;
    }
    if (query.target) {
      filter['target'] = query.target;
    }

    if (query.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(query.search);
      filter['$or'] = [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async getById(id: string) {
    const item = await this.model
      .findById(id)
      .populate('createdBy', 'firstName lastName email')
      .lean();
    if (!item) {
      throw new NotFoundException(appError('ANNOUNCEMENT_NOT_FOUND'));
    }
    return item;
  }

  async create(dto: CreateAnnouncementDto, adminId: string) {
    const data: Record<string, unknown> = {
      ...dto,
      createdBy: new Types.ObjectId(adminId),
    };
    if (dto.startsAt) {
      data['startsAt'] = new Date(dto.startsAt);
    }
    if (dto.expiresAt) {
      data['expiresAt'] = new Date(dto.expiresAt);
    }

    const announcement = await this.model.create(data);
    return announcement.toObject();
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException(appError('ANNOUNCEMENT_NOT_FOUND'));
    }

    if (dto.title !== undefined) {
      item.title = dto.title;
    }
    if (dto.content !== undefined) {
      item.content = dto.content;
    }
    if (dto.type !== undefined) {
      item.type = dto.type;
    }
    if (dto.target !== undefined) {
      item.target = dto.target;
    }
    if (dto.status !== undefined) {
      item.status = dto.status;
    }
    if (dto.dismissible !== undefined) {
      item.dismissible = dto.dismissible;
    }
    if (dto.actionUrl !== undefined) {
      item.actionUrl = dto.actionUrl;
    }
    if (dto.actionLabel !== undefined) {
      item.actionLabel = dto.actionLabel;
    }
    if (dto.zoneId !== undefined) {
      item.zoneId = dto.zoneId;
    }
    if (dto.priority !== undefined) {
      item.priority = dto.priority;
    }
    if (dto.startsAt !== undefined) {
      item.startsAt = new Date(dto.startsAt);
    }
    if (dto.expiresAt !== undefined) {
      item.expiresAt = new Date(dto.expiresAt);
    }

    return item.save();
  }

  async remove(id: string) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException(appError('ANNOUNCEMENT_NOT_FOUND'));
    }
    await item.deleteOne();
  }

  async publish(id: string) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException(appError('ANNOUNCEMENT_NOT_FOUND'));
    }
    item.status = AnnouncementStatus.ACTIVE;
    return item.save();
  }

  async archive(id: string) {
    const item = await this.model.findById(id);
    if (!item) {
      throw new NotFoundException(appError('ANNOUNCEMENT_NOT_FOUND'));
    }
    item.status = AnnouncementStatus.ARCHIVED;
    return item.save();
  }
}
