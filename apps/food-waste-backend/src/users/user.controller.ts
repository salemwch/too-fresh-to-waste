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
  HttpStatus,
  Res,
  HttpException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';

import { CreateUserDto } from './DTO/create-user.dto';
import { SendPhoneVerificationDto } from './DTO/send-phone-verification.dto';
import { UpdateLocationDto } from './DTO/update-location.dto';
import { UpdatePasswordDto } from './DTO/update-password.dto';
import { UpdateUserDto } from './DTO/update-user.dto';
import { VerifyPhoneDto } from './DTO/verify-phone.dto';
import { UserRole, UserStatus } from './schemas/user.schema';
import { UsersService } from './user.service';

@ApiTags('👥 User Management')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(CreateUserDto, UpdateUserDto)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: '👤 Create New User Account',
    description:
      'Register a new user account with optional profile image. This endpoint is public and does not require authentication.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User registration data with optional profile image',
    type: CreateUserDto,
    examples: {
      consumerRegistration: {
        summary: 'Consumer Registration',
        value: {
          email: 'consumer@example.com',
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+21612345678',
          role: 'consumer',
        },
      },
      merchantRegistration: {
        summary: 'Merchant Registration',
        value: {
          email: 'merchant@restaurant.tn',
          password: 'SecurePassword123!',
          firstName: 'Ahmed',
          lastName: 'Ben Ali',
          phoneNumber: '+21698765432',
          role: 'merchant',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ User account created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64a1b2c3d4e5f6789a0b1c2d' },
            email: { type: 'string', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            role: { type: 'string', example: 'consumer' },
            status: { type: 'string', example: 'pending' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to create user' },
        error: { type: 'string', example: 'Validation failed' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '❌ Conflict - User already exists',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'User with this email already exists' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('profileImage'))
  async create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      let profileImageUrl: string | null = null;

      // Upload profile image to Firebase Cloud Storage if provided
      if (file) {
        const uploadResult = await this.supabaseStorageService.uploadFile(file, {
          folder: 'profile-images',
          makePublic: true,
          metadata: { category: 'profile-image' },
          imageProcessing: {
            maxWidth: 400,
            maxHeight: 400,
            quality: 85,
            format: 'jpeg',
          },
        });

        profileImageUrl = uploadResult.downloadURL;
      }

      const user = await this.usersService.create({
        ...createUserDto,
        profileImage: profileImageUrl ?? undefined,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create user',
          error: (error as Error).message || error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 10;

      const users = await this.usersService.findAll(pageNum, limitNum);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Users retrieved successfully',
        data: users,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve users',
        error: (error as Error).message || error,
      });
    }
  }
  @Get('profile')
  async getProfile(@Request() req: AuthenticatedRequest, @Res() res: Response): Promise<Response> {
    try {
      if (!req.user?.userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          status: HttpStatus.UNAUTHORIZED,
          message: 'Unauthorized: No user found in request',
        });
      }

      const user = await this.usersService.findOne(req.user.userId);

      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).json({
          status: HttpStatus.NOT_FOUND,
          message: 'User profile not found',
        });
      }

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'User profile retrieved successfully',
        data: user,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch user profile',
        error: (error as Error).message,
      });
    }
  }
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.usersService.findOne(id);
      if (!user) {
        throw new HttpException({ message: 'User not found' }, HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'User fetched successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error fetching user' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('profile')
  async updateProfile(@Request() req: AuthenticatedRequest, @Body() updateUserDto: UpdateUserDto) {
    try {
      // `phone` is the shared-type / frontend field name.
      // The DB schema stores the same value as `phoneNumber` — remap here
      // so the service receives the correct field without leaking this
      // translation concern into the generic update() method.
      const { phone, ...rest } = updateUserDto;
      const payload: UpdateUserDto = phone !== undefined ? { ...rest, phoneNumber: phone } : rest;

      const updatedUser = await this.usersService.update(req.user.userId, payload);
      // Note: TransformInterceptor adds statusCode and timestamp
      return {
        message: 'Profile updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error updating profile' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update password for the authenticated user (no current password required)
   */
  @Patch('me/password')
  @ApiOperation({
    summary: 'Update password',
    description: 'Set a new password for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Password does not meet policy requirements' })
  async updatePassword(@Request() req: AuthenticatedRequest, @Body() dto: UpdatePasswordDto) {
    await this.usersService.updatePassword(req.user.userId, dto.newPassword);
    return { message: 'Password updated successfully' };
  }

  /**
   * Upload profile image for authenticated user
   * Accepts image file via multipart/form-data
   */
  @Patch('profile/image')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({
    summary: '📷 Upload Profile Image',
    description:
      'Upload a profile image for the authenticated user. Accepts JPEG, PNG, WebP formats.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile image file',
    schema: {
      type: 'object',
      properties: {
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP - max 5MB)',
        },
      },
      required: ['profileImage'],
    },
  })
  @ApiResponse({ status: 200, description: 'Profile image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or no file provided' })
  async uploadProfileImage(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException({ message: 'No image file provided' }, HttpStatus.BAD_REQUEST);
    }

    try {
      // Upload to Firebase Cloud Storage
      const uploadResult = await this.supabaseStorageService.uploadFile(file, {
        folder: 'profile-images',
        makePublic: true,
        metadata: { uploadedBy: req.user.userId, category: 'profile-image-update' },
        imageProcessing: {
          maxWidth: 400,
          maxHeight: 400,
          quality: 85,
          format: 'jpeg',
        },
      });

      // Update both profileImage and avatar for backward compatibility
      // (legacy code reads `avatar`, newer code reads `profileImage`)
      const updatedUser = await this.usersService.update(req.user.userId, {
        profileImage: uploadResult.downloadURL,
        avatar: uploadResult.downloadURL,
      });

      return {
        message: 'Profile image uploaded successfully',
        data: {
          profileImage: uploadResult.downloadURL,
          user: {
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            profileImage: updatedUser.profileImage,
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error uploading profile image' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user's last known location
   * Stores location for cross-device sync and location-based features
   */
  @Patch('location')
  @ApiOperation({
    summary: '📍 Update User Location',
    description:
      "Update the user's last known location for location-based features and cross-device sync. Location persists indefinitely until manually changed.",
  })
  @ApiBody({
    description: 'Location coordinates and optional metadata',
    type: UpdateLocationDto,
    examples: {
      gpsLocation: {
        summary: 'GPS Location',
        value: {
          latitude: 35.8288,
          longitude: 10.6405,
          locationName: 'Sousse, Tunisia',
          source: 'gps',
        },
      },
      manualLocation: {
        summary: 'Manual Location',
        value: {
          latitude: 36.8065,
          longitude: 10.1815,
          locationName: 'Tunis, Tunisia',
          source: 'manual',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Location updated successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Location updated successfully' },
        data: {
          type: 'object',
          properties: {
            latitude: { type: 'number', example: 35.8288 },
            longitude: { type: 'number', example: 10.6405 },
            locationName: { type: 'string', example: 'Sousse, Tunisia' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateLocation(
    @Request() req: AuthenticatedRequest,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    try {
      const result = await this.usersService.updateUserLocation(req.user.userId, updateLocationDto);

      // ✅ FIX: Add statusCode to match frontend expectations
      return {
        statusCode: HttpStatus.OK,
        message: 'Location updated successfully',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error updating location' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.usersService.update(id, updateUserDto);
      // Note: TransformInterceptor adds statusCode and timestamp
      return {
        message: 'User updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error updating user' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateStatus(@Param('id') id: string, @Body('status') status: UserStatus) {
    try {
      const updatedUser = await this.usersService.updateStatus(id, status);
      return {
        statusCode: HttpStatus.OK,
        message: 'User status updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        { message: (error as Error).message || 'Error updating status' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('phone/verify-request')
  @ApiOperation({
    summary: '📱 Send Phone Verification Code',
    description:
      'Send a 6-digit verification code via SMS to verify phone number. Rate limited to 5 requests per hour.',
  })
  @ApiBody({ type: SendPhoneVerificationDto })
  @ApiResponse({
    status: 200,
    description: '✅ Verification code sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Verification code sent successfully. Please check your phone.',
        },
        attemptsRemaining: { type: 'number', example: 4 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Invalid phone number or rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Too many verification attempts. Please try again later.',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '❌ Conflict - Phone number already registered',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'This phone number is already registered to another account',
        },
      },
    },
  })
  async sendPhoneVerification(
    @Request() req: AuthenticatedRequest,
    @Body() sendPhoneVerificationDto: SendPhoneVerificationDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const userAgentHeader = Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'];
      const result = await this.usersService.sendPhoneVerificationCode(
        req.user.userId,
        sendPhoneVerificationDto.phoneNumber,
        {
          ipAddress: req.ip ?? req.connection?.remoteAddress ?? 'unknown',
          userAgent: userAgentHeader ?? 'unknown',
        },
      );

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: (error as Error).message || 'Failed to send verification code',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('phone/verify')
  @ApiOperation({
    summary: '✅ Verify Phone Number',
    description:
      'Verify phone number with the 6-digit code received via SMS. Limited to 5 attempts per code.',
  })
  @ApiBody({ type: VerifyPhoneDto })
  @ApiResponse({
    status: 200,
    description: '✅ Phone number verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Phone number verified successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Invalid code or expired',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid verification code' },
        attemptsRemaining: { type: 'number', example: 3 },
      },
    },
  })
  async verifyPhone(
    @Request() req: AuthenticatedRequest,
    @Body() verifyPhoneDto: VerifyPhoneDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const userAgentHeader = Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'];
      const result = await this.usersService.verifyPhoneCode(
        req.user.userId,
        verifyPhoneDto.phoneNumber,
        verifyPhoneDto.code,
        {
          ipAddress: req.ip ?? req.connection?.remoteAddress ?? 'unknown',
          userAgent: userAgentHeader ?? 'unknown',
        },
      );

      const statusCode = result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
      return res.status(statusCode).json(result);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: (error as Error).message || 'Phone verification failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('phone/resend-code')
  @ApiOperation({
    summary: '🔄 Resend Phone Verification Code',
    description:
      'Resend verification code to the same phone number. Subject to rate limiting (5 per hour).',
  })
  @ApiBody({ type: SendPhoneVerificationDto })
  @ApiResponse({
    status: 200,
    description: '✅ Verification code resent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Verification code sent successfully. Please check your phone.',
        },
        attemptsRemaining: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Too many verification attempts. Please try again later.',
        },
      },
    },
  })
  async resendPhoneVerification(
    @Request() req: AuthenticatedRequest,
    @Body() sendPhoneVerificationDto: SendPhoneVerificationDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const userAgentHeader = Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'];
      const result = await this.usersService.resendPhoneVerificationCode(
        req.user.userId,
        sendPhoneVerificationDto.phoneNumber,
        {
          ipAddress: req.ip ?? req.connection?.remoteAddress ?? 'unknown',
          userAgent: userAgentHeader ?? 'unknown',
        },
      );

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: (error as Error).message || 'Failed to resend verification code',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 📍 GET USER LOCATION PREFERENCES
   *
   * Fetch user's saved location preferences for cross-device sync.
   * Industry best practice: Persist location across devices (Facebook/Instagram pattern).
   *
   * @returns Location preferences with default location and search radius
   */
  @Get('me/location-preferences')
  @ApiOperation({
    summary: '📍 Get Location Preferences',
    description:
      'Fetch user location preferences for cross-device sync. Returns last saved location and search radius.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location preferences retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          defaultLocation: { latitude: 32.0853, longitude: 34.7818 },
          searchRadius: 25,
          manualLocationName: 'Tel Aviv, Israel',
          source: 'gps',
        },
      },
    },
  })
  async getLocationPreferences(@Request() req: AuthenticatedRequest) {
    try {
      const userId = req.user.userId;
      const user = await this.usersService.findOne(userId);

      if (!user?.locationPreferences) {
        return {
          success: true,
          data: null, // No saved location
          message: 'No location preferences found',
        };
      }

      return {
        success: true,
        data: {
          defaultLocation: user.locationPreferences.defaultLocation,
          searchRadius: user.locationPreferences.searchRadius || 25,
          // Return most recent location from history if available
          lastKnownLocation: user.locationPreferences.locationHistory?.[0],
        },
      };
    } catch (error) {
      throw new HttpException(
        { message: 'Failed to fetch location preferences' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📍 SAVE USER LOCATION PREFERENCES
   *
   * Save user's location preferences for cross-device persistence.
   * Industry best practice: Sync location to backend (Facebook/Instagram pattern).
   *
   * @param body - Location data (coordinates, radius, name, source)
   * @returns Success confirmation
   */
  @Patch('me/location-preferences')
  @ApiOperation({
    summary: '📍 Save Location Preferences',
    description:
      'Save user location preferences to backend for cross-device sync. Called when user selects/changes location.',
  })
  @ApiBody({
    schema: {
      example: {
        coordinates: { latitude: 32.0853, longitude: 34.7818 },
        searchRadius: 25,
        manualLocationName: 'Tel Aviv, Israel',
        source: 'gps',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location preferences saved successfully',
  })
  async saveLocationPreferences(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      coordinates?: { latitude: number; longitude: number };
      searchRadius?: number;
      manualLocationName?: string;
      source?: 'gps' | 'manual';
    },
  ) {
    try {
      const userId = req.user.userId;

      await this.usersService.updateLocationPreferences(userId, {
        defaultLocation: body.coordinates,
        searchRadius: body.searchRadius,
        locationHistory: body.coordinates
          ? [
              {
                coordinates: body.coordinates,
                timestamp: new Date(),
                source: body.source || 'manual',
              },
            ]
          : undefined,
      });

      return {
        success: true,
        message: 'Location preferences saved successfully',
      };
    } catch (error) {
      throw new HttpException(
        { message: 'Failed to save location preferences' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore soft-deleted user account' })
  @ApiResponse({ status: 200, description: 'User restored successfully' })
  async restore(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const ipAddress = req.ip ?? req.connection?.remoteAddress ?? 'unknown';
    const userAgentHeader = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'];
    const userAgent = userAgentHeader ?? 'unknown';
    const user = await this.usersService.restore(id, { ipAddress, userAgent });
    return { statusCode: HttpStatus.OK, message: 'User restored successfully', data: user };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a user account' })
  @ApiResponse({ status: 200, description: 'User soft-deleted successfully' })
  async remove(
    @Param('id') id: string,
    @Query('reason') reason: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip ?? req.connection?.remoteAddress ?? 'unknown';
    const userAgentHeader = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'];
    const userAgent = userAgentHeader ?? 'unknown';
    await this.usersService.softDelete(
      id,
      reason || 'Admin deletion',
      { ipAddress, userAgent },
      { adminId: req.user.userId, adminEmail: req.user.email },
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'User soft-deleted successfully',
    };
  }
}
