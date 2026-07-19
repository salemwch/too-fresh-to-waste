import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import {
  TicketSearchDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  UpdateTicketPriorityDto,
  ReplyToTicketDto,
} from '../dto/support-ticket.dto';
import { SupportTicketService } from '../services/support-ticket.service';

@ApiTags('Admin Support Tickets')
@Controller('admin/support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiBearerAuth()
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Get()
  @ApiOperation({ summary: 'List support tickets with filters' })
  async listTickets(@Query() query: TicketSearchDto) {
    const result = await this.ticketService.listTickets(query);
    return {
      status: 'success',
      message: 'Support tickets retrieved',
      data: result.tickets,
      meta: { page: result.page, limit: result.limit, total: result.total },
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ticket stats overview' })
  async getStats() {
    const stats = await this.ticketService.getStats();
    return {
      status: 'success',
      message: 'Ticket statistics retrieved',
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single ticket with full details' })
  async getTicket(@Param('id') id: string) {
    const ticket = await this.ticketService.getTicketById(id);
    return {
      status: 'success',
      message: 'Ticket retrieved',
      data: ticket,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketService.updateStatus(id, dto);
    return {
      status: 'success',
      message: 'Ticket status updated',
      data: ticket,
    };
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign ticket to admin/moderator' })
  async assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    const ticket = await this.ticketService.assignTicket(id, dto);
    return {
      status: 'success',
      message: 'Ticket assigned',
      data: ticket,
    };
  }

  @Patch(':id/priority')
  @ApiOperation({ summary: 'Change ticket priority' })
  async updatePriority(@Param('id') id: string, @Body() dto: UpdateTicketPriorityDto) {
    const ticket = await this.ticketService.updatePriority(id, dto);
    return {
      status: 'success',
      message: 'Ticket priority updated',
      data: ticket,
    };
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Add admin reply to ticket' })
  async addReply(
    @Param('id') id: string,
    @GetUser('userId') adminId: string,
    @Body() dto: ReplyToTicketDto,
  ) {
    const ticket = await this.ticketService.addReply(id, adminId, dto);
    return {
      status: 'success',
      message: 'Reply added',
      data: ticket,
    };
  }
}
