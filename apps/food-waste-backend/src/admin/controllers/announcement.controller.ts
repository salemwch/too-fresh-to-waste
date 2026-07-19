import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementSearchDto,
} from '../dto/announcement.dto';
import { AnnouncementService } from '../services/announcement.service';

@ApiTags('Admin Announcements')
@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiBearerAuth()
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  @ApiOperation({ summary: 'List announcements with filters' })
  async list(@Query() query: AnnouncementSearchDto) {
    const result = await this.announcementService.list(query);
    return {
      status: 'success',
      message: 'Announcements retrieved',
      data: result.items,
      meta: { page: result.page, limit: result.limit, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single announcement' })
  async getById(@Param('id') id: string) {
    const item = await this.announcementService.getById(id);
    return { status: 'success', message: 'Announcement retrieved', data: item };
  }

  @Post()
  @ApiOperation({ summary: 'Create announcement' })
  async create(@Body() dto: CreateAnnouncementDto, @GetUser('userId') adminId: string) {
    const item = await this.announcementService.create(dto, adminId);
    return { status: 'success', message: 'Announcement created', data: item };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update announcement' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    const item = await this.announcementService.update(id, dto);
    return { status: 'success', message: 'Announcement updated', data: item };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish announcement' })
  async publish(@Param('id') id: string) {
    const item = await this.announcementService.publish(id);
    return { status: 'success', message: 'Announcement published', data: item };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive announcement' })
  async archive(@Param('id') id: string) {
    const item = await this.announcementService.archive(id);
    return { status: 'success', message: 'Announcement archived', data: item };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete announcement' })
  async remove(@Param('id') id: string) {
    await this.announcementService.remove(id);
    return { status: 'success', message: 'Announcement deleted' };
  }
}
