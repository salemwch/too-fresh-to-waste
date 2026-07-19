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
import { CreateGeozoneDto, UpdateGeozoneDto, GeozoneSearchDto } from '../dto/geozone.dto';
import { GeozoneService } from '../services/geozone.service';

@ApiTags('Admin Geozones')
@Controller('admin/geozones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class GeozoneController {
  constructor(private readonly geozoneService: GeozoneService) {}

  @Get()
  @ApiOperation({ summary: 'List geozones with filters' })
  async list(@Query() query: GeozoneSearchDto) {
    const result = await this.geozoneService.list(query);
    return {
      status: 'success',
      message: 'Geozones retrieved',
      data: result.items,
      meta: { page: result.page, limit: result.limit, total: result.total },
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get geozone coverage stats' })
  async getStats() {
    const stats = await this.geozoneService.getStats();
    return { status: 'success', message: 'Geozone stats retrieved', data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single geozone' })
  async getById(@Param('id') id: string) {
    const item = await this.geozoneService.getById(id);
    return { status: 'success', message: 'Geozone retrieved', data: item };
  }

  @Post()
  @ApiOperation({ summary: 'Create geozone' })
  async create(@Body() dto: CreateGeozoneDto) {
    const item = await this.geozoneService.create(dto);
    return { status: 'success', message: 'Geozone created', data: item };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update geozone' })
  async update(@Param('id') id: string, @Body() dto: UpdateGeozoneDto) {
    const item = await this.geozoneService.update(id, dto);
    return { status: 'success', message: 'Geozone updated', data: item };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete geozone' })
  async remove(@Param('id') id: string) {
    await this.geozoneService.remove(id);
    return { status: 'success', message: 'Geozone deleted' };
  }
}
