import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import {
  SupportTicket,
  SupportTicketDocument,
  TicketStatus,
} from '../schemas/support-ticket.schema';
import {
  TicketSearchDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  UpdateTicketPriorityDto,
  ReplyToTicketDto,
} from '../dto/support-ticket.dto';

import { appError } from '../../common/errors';
@Injectable()
export class SupportTicketService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {}

  async listTickets(query: TicketSearchDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.priority) {
      filter['priority'] = query.priority;
    }
    if (query.category) {
      filter['category'] = query.category;
    }
    if (query.assignedTo) {
      filter['assignedTo'] = new Types.ObjectId(query.assignedTo);
    }

    if (query.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(query.search);
      filter['$or'] = [
        { subject: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName email')
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return { tickets, total, page, limit };
  }

  async getTicketById(id: string) {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('userId', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('relatedOrderId')
      .lean();

    if (!ticket) {
      throw new NotFoundException(appError('TICKET_NOT_FOUND'));
    }
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException(appError('TICKET_NOT_FOUND'));
    }

    ticket.status = dto.status;
    if (dto.resolutionNote) {
      ticket.resolutionNote = dto.resolutionNote;
    }
    if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED) {
      ticket.resolvedAt = new Date();
    }

    return ticket.save();
  }

  async assignTicket(id: string, dto: AssignTicketDto) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException(appError('TICKET_NOT_FOUND'));
    }

    ticket.assignedTo = new Types.ObjectId(dto.assignedTo);
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    return ticket.save();
  }

  async updatePriority(id: string, dto: UpdateTicketPriorityDto) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException(appError('TICKET_NOT_FOUND'));
    }

    ticket.priority = dto.priority;
    return ticket.save();
  }

  async addReply(id: string, adminId: string, dto: ReplyToTicketDto) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException(appError('TICKET_NOT_FOUND'));
    }

    ticket.replies.push({
      authorId: new Types.ObjectId(adminId),
      authorRole: 'admin',
      message: dto.message,
      createdAt: new Date(),
    });

    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
    }

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    return ticket.save();
  }

  async getStats() {
    const [statusCounts, priorityCounts, categoryCounts] = await Promise.all([
      this.ticketModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const openCount = statusCounts
      .filter(s => s._id !== TicketStatus.RESOLVED && s._id !== TicketStatus.CLOSED)
      .reduce((sum, s) => sum + s.count, 0);
    const resolvedCount = statusCounts
      .filter(s => s._id === TicketStatus.RESOLVED || s._id === TicketStatus.CLOSED)
      .reduce((sum, s) => sum + s.count, 0);

    return {
      open: openCount,
      resolved: resolvedCount,
      total: openCount + resolvedCount,
      byStatus: Object.fromEntries(statusCounts.map(s => [s._id, s.count])),
      byPriority: Object.fromEntries(priorityCounts.map(s => [s._id, s.count])),
      byCategory: Object.fromEntries(categoryCounts.map(s => [s._id, s.count])),
    };
  }
}
