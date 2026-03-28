import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Request,
  UseGuards,
  HttpStatus,
  HttpException,
  Ip,
  Headers,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { createObjectCsvStringifier } from 'csv-writer';
import { Response } from 'express';
import { Builder } from 'xml2js';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TunisianPrivacyConsentDto,
  InternationalPrivacyConsentDto,
  UpdatePrivacySettingsDto,
  DataExportRequestDto,
  DataDeletionRequestDto,
  ConsentWithdrawalDto,
} from '../DTO/privacy-consent.dto';
import {
  IUserDataExport,
  ISystemComplianceOverview,
  IAnonymizationResult,
} from '../interfaces/privacy-consent.interface';
import { UserRole } from '../schemas/user.schema';
import { PrivacyComplianceService } from '../services/privacy-compliance.service';
// @ts-expect-error no types available for xml2js

interface AuthenticatedRequest {
  user: AuthUser;
}

interface TunisianComplianceResponse {
  compliant: boolean;
  missingConsents: string[];
  recommendations: string[];
}

interface ConsentWithdrawalResponse {
  message: string;
  legalBasis: string[];
}

interface DataDeletionResponse {
  message: string;
  deletionResult: IAnonymizationResult;
  legalBasis: string;
  processingTime: string;
}

@ApiTags('🇹🇳🌍 Privacy & Data Protection')
@Controller('privacy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyComplianceService) {}

  // 🇹🇳 TUNISIA COMPLIANCE ENDPOINTS

  @Post('consent/tunisia')
  @ApiOperation({
    summary: '🇹🇳 Record Tunisian Privacy Consent',
    description:
      'Record user consent according to Tunisia Law No. 2004-63 on Personal Data Protection',
  })
  @ApiResponse({
    status: 201,
    description: 'Consent recorded successfully in compliance with Tunisia Law',
  })
  @ApiResponse({ status: 400, description: 'Invalid consent data' })
  @ApiBody({ type: TunisianPrivacyConsentDto })
  async recordTunisianConsent(
    @Request() req: AuthenticatedRequest,
    @Body() consentData: TunisianPrivacyConsentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string = 'Unknown',
  ): Promise<{ message: string; compliance: string; timestamp: Date }> {
    try {
      await this.privacyService.recordTunisianConsent(
        req.user.userId,
        consentData,
        ipAddress,
        userAgent,
      );

      return {
        message: '🇹🇳 Consent recorded successfully under Tunisia Law No. 2004-63',
        compliance: 'Tunisia Personal Data Protection Law',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to record consent',
          error: (error as Error).message,
          compliance: 'Tunisia Law No. 2004-63',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('compliance/tunisia')
  @ApiOperation({
    summary: '🇹🇳 Check Tunisia Law Compliance',
    description: 'Validate user compliance with Tunisia Law No. 2004-63',
  })
  @ApiResponse({
    status: 200,
    description: 'Compliance status retrieved successfully',
  })
  async checkTunisianCompliance(@Request() req: AuthenticatedRequest): Promise<{
    compliant: boolean;
    law: string;
    missingConsents: string[];
    recommendations: string[];
  }> {
    try {
      const complianceResult: TunisianComplianceResponse =
        await this.privacyService.validateTunisianCompliance(req.user.userId);

      return {
        ...complianceResult,
        law: '🇹🇳 Tunisia Law No. 2004-63 on Personal Data Protection',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to check compliance',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🌍 INTERNATIONAL COMPLIANCE ENDPOINTS

  @Post('consent/international')
  @ApiOperation({
    summary: '🌍 Record International Privacy Consent',
    description: 'Record user consent under GDPR, CCPA and other international privacy laws',
  })
  @ApiResponse({
    status: 201,
    description: 'International consent recorded successfully',
  })
  @ApiBody({ type: InternationalPrivacyConsentDto })
  async recordInternationalConsent(
    @Request() req: AuthenticatedRequest,
    @Body() consentData: InternationalPrivacyConsentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string = 'Unknown',
  ): Promise<{
    message: string;
    compliance: string[];
    timestamp: Date;
  }> {
    try {
      await this.privacyService.recordInternationalConsent(
        req.user.userId,
        consentData,
        ipAddress,
        userAgent,
      );

      return {
        message: '🌍 International consent recorded successfully',
        compliance: [
          '🇹🇳 Tunisia Law No. 2004-63',
          '🇪🇺 GDPR (General Data Protection Regulation)',
          '🇺🇸 CCPA (California Consumer Privacy Act)',
        ],
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to record international consent',
          error: (error as Error).message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('settings')
  @ApiOperation({
    summary: '🇹🇳🌍 Update Privacy Settings',
    description: 'Update privacy settings for both Tunisia and international compliance',
  })
  @ApiResponse({ status: 200, description: 'Privacy settings updated successfully' })
  @ApiBody({ type: UpdatePrivacySettingsDto })
  async updatePrivacySettings(
    @Request() req: AuthenticatedRequest,
    @Body() updateData: UpdatePrivacySettingsDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string = 'Unknown',
  ): Promise<{ message: string; updated: string[] }> {
    try {
      const updated: string[] = [];

      if (updateData.tunisianCompliance) {
        await this.privacyService.recordTunisianConsent(
          req.user.userId,
          updateData.tunisianCompliance,
          ipAddress,
          userAgent,
        );
        updated.push('🇹🇳 Tunisia compliance');
      }

      if (updateData.internationalCompliance) {
        await this.privacyService.recordInternationalConsent(
          req.user.userId,
          updateData.internationalCompliance,
          ipAddress,
          userAgent,
        );
        updated.push('🌍 International compliance');
      }

      return {
        message: 'Privacy settings updated successfully',
        updated,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to update privacy settings',
          error: (error as Error).message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // DATA SUBJECT RIGHTS

  @Post('consent/withdraw')
  @ApiOperation({
    summary: '🔄 Withdraw Consent',
    description: 'Withdraw specific consent (GDPR Article 7(3), Tunisia Law Article 13)',
  })
  @ApiResponse({ status: 200, description: 'Consent withdrawn successfully' })
  @ApiBody({ type: ConsentWithdrawalDto })
  async withdrawConsent(
    @Request() req: AuthenticatedRequest,
    @Body() withdrawalData: ConsentWithdrawalDto,
  ): Promise<ConsentWithdrawalResponse> {
    try {
      await this.privacyService.withdrawConsent(req.user.userId, withdrawalData);

      return {
        message: 'Consent withdrawn successfully',
        legalBasis: [
          '🇹🇳 Tunisia Law No. 2004-63 Article 13 - Right to withdraw consent',
          '🌍 GDPR Article 7(3) - Right to withdraw consent at any time',
        ],
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to withdraw consent',
          error: (error as Error).message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('data/export')
  @ApiOperation({
    summary: '📤 Export Personal Data',
    description:
      'Export all personal data (GDPR Article 20 - Data Portability, Tunisia Law Article 15)',
  })
  @ApiResponse({
    status: 200,
    description: 'Data export completed successfully',
    type: 'file',
  })
  @ApiBody({ type: DataExportRequestDto })
  async exportData(
    @Request() req: AuthenticatedRequest,
    @Body() exportRequest: DataExportRequestDto,
    @Ip() ipAddress: string,
    @Res() res: Response,
    @Headers('user-agent') userAgent: string = 'Unknown',
  ): Promise<void> {
    try {
      const exportData: IUserDataExport = await this.privacyService.exportUserData(
        req.user.userId,
        exportRequest,
        ipAddress,
        userAgent,
      );

      const filename = `data-export-${req.user.userId}-${new Date().toISOString().split('T')[0]}.${exportRequest.format}`;

      res.setHeader('Content-Type', this.getContentType(exportRequest.format));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Legal-Basis', '🇹🇳 Tunisia Law Article 15 + 🌍 GDPR Article 20');

      if (exportRequest.format === 'json') {
        res.json(exportData);
      } else if (exportRequest.format === 'csv') {
        const csv = this.convertToCSV(exportData);
        res.send(csv);
      } else if (exportRequest.format === 'xml') {
        const xml = this.convertToXML(exportData);
        res.send(xml);
      }
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to export data',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('data/delete')
  @ApiOperation({
    summary: '🗑️ Request Data Deletion',
    description:
      'Request account deletion or anonymization (GDPR Article 17 - Right to be Forgotten)',
  })
  @ApiResponse({ status: 200, description: 'Data deletion request processed successfully' })
  @ApiBody({ type: DataDeletionRequestDto })
  async requestDataDeletion(
    @Request() req: AuthenticatedRequest,
    @Body() deletionRequest: DataDeletionRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string = 'Unknown',
  ): Promise<DataDeletionResponse> {
    try {
      const deletionResult: IAnonymizationResult = await this.privacyService.processDataDeletion(
        req.user.userId,
        deletionRequest,
        ipAddress,
        userAgent,
      );

      return {
        message: 'Data deletion request processed successfully',
        deletionResult,
        legalBasis: '🇹🇳 Tunisia Law No. 2004-63 + 🌍 GDPR Article 17 - Right to be Forgotten',
        processingTime: deletionRequest.immediateProcessing ? 'Immediate' : 'Within 30 days',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to process data deletion',
          error: (error as Error).message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ADMIN ENDPOINTS

  @Get('admin/compliance/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: '👨‍💼 Admin: Privacy Compliance Overview',
    description: 'Get overall privacy compliance statistics (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Compliance overview retrieved successfully' })
  async getComplianceOverview(): Promise<ISystemComplianceOverview> {
    try {
      const complianceOverview: ISystemComplianceOverview =
        await this.privacyService.getSystemComplianceOverview();

      return complianceOverview;
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to retrieve compliance overview',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PRIVATE HELPER METHODS

  private getContentType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  private convertToCSV(data: IUserDataExport): string {
    // Define headers
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'field', title: 'Field' },
        { id: 'value', title: 'Value' },
      ],
    });

    // Flatten all data sections
    const records: { field: string; value: string }[] = [];

    // Personal data
    Object.entries(data.personalData).forEach(([key, value]) => {
      records.push({
        field: `personalData.${key}`,
        value: value?.toString() ?? '',
      });
    });

    // Export metadata
    records.push(
      {
        field: 'exportedAt',
        value: data.exportMetadata.exportedAt.toISOString(),
      },
      {
        field: 'legalBasis',
        value: data.exportMetadata.legal_notices.tunisia_law,
      },
    );

    // Convert to CSV string with header
    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  private convertToXML(data: IUserDataExport): string {
    const builder = new Builder({ headless: false, renderOpts: { pretty: true } });

    const obj = {
      userDataExport: {
        personalData: {
          id: data.personalData.id,
          email: data.personalData.email,
          firstName: data.personalData.firstName,
          lastName: data.personalData.lastName,
          createdAt: data.personalData.createdAt,
        },
        exportMetadata: {
          exportedAt: data.exportMetadata.exportedAt,
          legalBasis: data.exportMetadata.legal_notices.tunisia_law,
          format: data.exportMetadata.format,
        },
      },
    };

    return builder.buildObject(obj);
  }
}
