import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsInvitationService } from './organizations-invitation.service';
import { OrganizationsService } from './organizations.service';

import { OrganizationStatus } from '@foodwaste/shared';

import { appError } from '../common/errors';
@ApiTags('🏢 Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly invitationService: OrganizationsInvitationService,
  ) {}

  // ── PUBLIC ROUTES (no auth) ─────────────────────────────────────────────────
  // IMPORTANT: These must come before any :id-param routes.

  @Get('invitations/verify/:token')
  @Public()
  @ApiOperation({ summary: 'Verify an invitation token (public)' })
  @ApiResponse({ status: 200, description: 'Token details returned' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async verifyInvitation(@Param('token') token: string) {
    const result = await this.invitationService.getByToken(token);
    return {
      message: 'Invitation details retrieved',
      data: result,
    };
  }

  @Post('invitations/accept')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept an invitation and create account (public)' })
  @ApiResponse({ status: 201, description: 'Account created and invitation accepted' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    const result = await this.invitationService.accept(dto);
    return {
      message: result.message,
      data: null,
    };
  }

  // ── ADMIN LIST (before :id to avoid param collision) ─────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all organizations (admin)' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrganizationStatus,
  ) {
    const result = await this.organizationsService.findAll(page, limit, status);
    return {
      message: 'Organizations retrieved successfully',
      data: result.organizations,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1,
      },
    };
  }

  // ── MY ORGANIZATION (before :id) ─────────────────────────────────────────────

  @Get('my-organization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @ApiOperation({ summary: "Get the current user's organization" })
  async getMyOrganization(@Request() req: AuthenticatedRequest) {
    const org = await this.organizationsService.findByOwnerId(req.user.userId);

    if (!org) {
      return {
        message: 'No organization found',
        data: null,
      };
    }

    return {
      message: 'Organization retrieved successfully',
      data: org,
    };
  }

  // ── MERCHANT: CREATE ORGANIZATION ────────────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization (merchant)' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 409, description: 'Organization already exists for this merchant' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @Query('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!establishmentId) {
      throw new BadRequestException(appError('ESTABLISHMENT_REQUIRED'));
    }

    const org = await this.organizationsService.create(dto, req.user.userId, establishmentId);
    return {
      message: 'Organization created successfully. Pending admin approval.',
      data: org,
    };
  }

  // ── GET BY ID ────────────────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const org = await this.organizationsService.findById(id);
    if (req.user.role !== UserRole.ADMIN && org.ownerId.toString() !== req.user.userId) {
      throw new ForbiddenException(appError('ORGANIZATION_NOT_YOURS'));
    }
    return {
      message: 'Organization retrieved successfully',
      data: org,
    };
  }

  // ── MERCHANT: UPDATE ─────────────────────────────────────────────────────────

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Update organization (owner only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.update(id, dto, req.user.userId);
    return {
      message: 'Organization updated successfully',
      data: org,
    };
  }

  // ── ADMIN: UPDATE STATUS ──────────────────────────────────────────────────────

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or suspend an organization (admin)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: OrganizationStatus) {
    if (!Object.values(OrganizationStatus).includes(status)) {
      throw new BadRequestException(
        appError('INVALID_STATUS', {
          allowed: String(Object.values(OrganizationStatus).join(', ')),
        }),
      );
    }

    const org = await this.organizationsService.updateStatus(id, status);
    return {
      message: `Organization status updated to ${status}`,
      data: org,
    };
  }

  // ── MERCHANT: MANAGE ESTABLISHMENTS ─────────────────────────────────────────

  @Post(':id/establishments/:establishmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add an establishment to the organization' })
  async addEstablishment(
    @Param('id') id: string,
    @Param('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.addEstablishment(
      id,
      establishmentId,
      req.user.userId,
    );
    return {
      message: 'Establishment added to organization',
      data: org,
    };
  }

  @Delete(':id/establishments/:establishmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Remove an establishment from the organization' })
  async removeEstablishment(
    @Param('id') id: string,
    @Param('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.removeEstablishment(
      id,
      establishmentId,
      req.user.userId,
    );
    return {
      message: 'Establishment removed from organization',
      data: org,
    };
  }

  // ── MERCHANT: INVITATIONS ────────────────────────────────────────────────────

  @Post(':id/invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a location manager to the organization' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 409, description: 'Pending invitation already exists' })
  async invite(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const invitation = await this.invitationService.invite(id, dto, req.user.userId);
    return {
      message: 'Invitation sent successfully',
      data: invitation,
    };
  }

  @Get(':id/invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'List invitations for an organization (owner only)' })
  async listInvitations(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const invitations = await this.invitationService.findByOrganization(id, req.user.userId);
    return {
      message: 'Invitations retrieved successfully',
      data: invitations,
    };
  }

  @Delete('invitations/:invitationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.invitationService.revoke(invitationId, req.user.userId);
    return {
      message: result.message,
      data: null,
    };
  }
}
