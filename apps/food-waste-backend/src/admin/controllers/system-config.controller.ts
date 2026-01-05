import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
  Req
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { SystemConfigService } from '../services/system-config.service';
import { UpdateSystemConfigDto } from '../dto/system-config.dto';
import { IpAddress, UserAgent } from '../decorators';
import { ISystemConfig, IConfigValidationResult } from '../../common/interfaces/system-config.interface';
import { ImportConfigDto } from '../decorators/config-item';

@ApiTags('Admin System Configuration')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class SystemConfigController {
  private readonly logger = new Logger(SystemConfigController.name);

  constructor(
    private readonly systemConfigService: SystemConfigService,
  ) { }

  @Get()
  @ApiOperation({
    summary: 'Get current system configuration',
    description: 'Retrieve the current active system configuration'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System configuration retrieved successfully'
  })
  getSystemConfig(): Promise<ISystemConfig> {
    return this.systemConfigService.getSystemConfig();
  }

  @Put()
  @ApiOperation({
    summary: 'Update system configuration',
    description: 'Update system configuration settings. Creates a new version and deactivates the previous one.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System configuration updated successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Configuration validation failed'
  })
  updateSystemConfig(
    @Body() updateDto: UpdateSystemConfigDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<ISystemConfig> {
    const admin = req.user;

    this.logger.log(`Admin ${admin.email} updating system configuration`);

    return this.systemConfigService.updateSystemConfig(
      updateDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get configuration history',
    description: 'Retrieve the history of system configuration changes'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration history retrieved successfully'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of results (default: 20)' })
  getConfigHistory(
    @Query('limit') limit?: number
  ): Promise<ISystemConfig[]> {
    return this.systemConfigService.getConfigHistory(limit || 20);
  }

  @Post('rollback/:version')
  @ApiOperation({
    summary: 'Rollback to previous configuration version',
    description: 'Rollback system configuration to a specific version'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration rolled back successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Configuration version not found'
  })
  @ApiParam({ name: 'version', description: 'Configuration version to rollback to' })
  rollbackToVersion(
    @Param('version') version: string,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<ISystemConfig> {
    const admin = req.user;

    this.logger.warn(`Admin ${admin.email} rolling back configuration to version ${version}`);

    return this.systemConfigService.rollbackToVersion(
      version,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export system configuration',
    description: 'Export system configuration as JSON'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration exported successfully'
  })
  @ApiQuery({ name: 'version', required: false, type: String, description: 'Specific version to export (default: current)' })
  exportConfig(
    @Query('version') version?: string
  ): Promise<unknown> {
    return this.systemConfigService.exportConfig(version);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import system configuration',
    description: 'Import and apply system configuration from JSON data'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration imported successfully'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Import validation failed'
  })
  @ApiConsumes('application/json')
  @ApiBody({
    description: 'Configuration data to import',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string' },
        platformSettings: { type: 'object' },
        notificationSettings: { type: 'object' },
        securitySettings: { type: 'object' },
        paymentSettings: { type: 'object' },
        description: { type: 'string' }
      }
    }
  })
  importConfig(
    @Body() importData: ImportConfigDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<ISystemConfig> {
    const admin = req.user;

    this.logger.log(`Admin ${admin.email} importing configuration from version ${importData.version || 'unknown'}`);

    return this.systemConfigService.importConfig(
      importData,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }

  @Post('validate-import')
  @ApiOperation({
    summary: 'Validate configuration import',
    description: 'Validate configuration data without applying it'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration validation completed'
  })
  @ApiConsumes('application/json')
  validateConfigImport(
    @Body() importData: ImportConfigDto
  ): IConfigValidationResult {
    return this.systemConfigService.validateConfigImport(importData);
  }
}