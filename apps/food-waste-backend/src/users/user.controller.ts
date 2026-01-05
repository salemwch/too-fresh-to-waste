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
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiExtraModels
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, UserStatus } from './schemas/user.schema';
import { UsersService } from './user.service';
import { CreateUserDto } from './DTO/create-user.dto';
import { UpdateUserDto } from './DTO/update-user.dto';
import { SendPhoneVerificationDto } from './DTO/send-phone-verification.dto';
import { VerifyPhoneDto } from './DTO/verify-phone.dto';
import { Response } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseStorageService } from '../common/services/firebase-storage.service';

@ApiTags('👥 User Management')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(CreateUserDto, UpdateUserDto)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly firebaseStorageService: FirebaseStorageService,
    ) { }

    @Post()
    @Public()
    @ApiOperation({
        summary: '👤 Create New User Account',
        description: 'Register a new user account with optional profile image. This endpoint is public and does not require authentication.'
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
                    role: 'consumer'
                }
            },
            merchantRegistration: {
                summary: 'Merchant Registration',
                value: {
                    email: 'merchant@restaurant.tn',
                    password: 'SecurePassword123!',
                    firstName: 'Ahmed',
                    lastName: 'Ben Ali',
                    phoneNumber: '+21698765432',
                    role: 'merchant'
                }
            }
        }
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
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                }
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: '❌ Bad Request - Invalid input data',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to create user' },
                error: { type: 'string', example: 'Validation failed' }
            }
        }
    })
    @ApiResponse({
        status: 409,
        description: '❌ Conflict - User already exists',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'User with this email already exists' }
            }
        }
    })
    @UseInterceptors(FileInterceptor('profileImage'))
    async create(
        @Body() createUserDto: CreateUserDto,
        @UploadedFile() file: Express.Multer.File,
        @Res() res: Response,
    ): Promise<Response> {
        try {
            let profileImageUrl: string | null = null;

            // Upload profile image to Firebase Storage if provided
            if (file) {
                const uploadResult = await this.firebaseStorageService.uploadFile(file, {
                    folder: 'profile-images',
                    makePublic: true,
                    imageProcessing: {
                        maxWidth: 400,
                        maxHeight: 400,
                        quality: 85,
                        format: 'jpeg',
                    },
                    metadata: {
                        uploadedBy: 'user-registration',
                        category: 'profile-image',
                    },
                });

                profileImageUrl = uploadResult.downloadURL;
            }

            const user = await this.usersService.create({
                ...createUserDto,
                profileImage: profileImageUrl,
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
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Res() res?: Response,
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
    async getProfile(@Request() req, @Res() res: Response): Promise<Response> {
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
                throw new HttpException(
                    { message: 'User not found' },
                    HttpStatus.NOT_FOUND,
                );
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
    async updateProfile(
        @Request() req,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        try {
            const updatedUser = await this.usersService.update(
                req.user.userId,
                updateUserDto,
            );
            return {
                statusCode: HttpStatus.OK,
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

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        try {
            const updatedUser = await this.usersService.update(id, updateUserDto);
            return {
                statusCode: HttpStatus.OK,
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
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: UserStatus,
    ) {
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
        description: 'Send a 6-digit verification code via SMS to verify phone number. Rate limited to 5 requests per hour.'
    })
    @ApiBody({ type: SendPhoneVerificationDto })
    @ApiResponse({
        status: 200,
        description: '✅ Verification code sent successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Verification code sent successfully. Please check your phone.' },
                attemptsRemaining: { type: 'number', example: 4 }
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: '❌ Bad Request - Invalid phone number or rate limit exceeded',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Too many verification attempts. Please try again later.' }
            }
        }
    })
    @ApiResponse({
        status: 409,
        description: '❌ Conflict - Phone number already registered',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'This phone number is already registered to another account' }
            }
        }
    })
    async sendPhoneVerification(
        @Request() req,
        @Body() sendPhoneVerificationDto: SendPhoneVerificationDto,
        @Res() res: Response
    ): Promise<Response> {
        try {
            const result = await this.usersService.sendPhoneVerificationCode(
                req.user.userId,
                sendPhoneVerificationDto.phoneNumber,
                {
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            );

            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: (error as Error).message || 'Failed to send verification code'
                },
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Post('phone/verify')
    @ApiOperation({
        summary: '✅ Verify Phone Number',
        description: 'Verify phone number with the 6-digit code received via SMS. Limited to 5 attempts per code.'
    })
    @ApiBody({ type: VerifyPhoneDto })
    @ApiResponse({
        status: 200,
        description: '✅ Phone number verified successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Phone number verified successfully' }
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: '❌ Bad Request - Invalid code or expired',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Invalid verification code' },
                attemptsRemaining: { type: 'number', example: 3 }
            }
        }
    })
    async verifyPhone(
        @Request() req,
        @Body() verifyPhoneDto: VerifyPhoneDto,
        @Res() res: Response
    ): Promise<Response> {
        try {
            const result = await this.usersService.verifyPhoneCode(
                req.user.userId,
                verifyPhoneDto.phoneNumber,
                verifyPhoneDto.code,
                {
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            );

            const statusCode = result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
            return res.status(statusCode).json(result);
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: (error as Error).message || 'Phone verification failed'
                },
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Post('phone/resend-code')
    @ApiOperation({
        summary: '🔄 Resend Phone Verification Code',
        description: 'Resend verification code to the same phone number. Subject to rate limiting (5 per hour).'
    })
    @ApiBody({ type: SendPhoneVerificationDto })
    @ApiResponse({
        status: 200,
        description: '✅ Verification code resent successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Verification code sent successfully. Please check your phone.' },
                attemptsRemaining: { type: 'number', example: 3 }
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: '❌ Bad Request - Rate limit exceeded',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Too many verification attempts. Please try again later.' }
            }
        }
    })
    async resendPhoneVerification(
        @Request() req,
        @Body() sendPhoneVerificationDto: SendPhoneVerificationDto,
        @Res() res: Response
    ): Promise<Response> {
        try {
            const result = await this.usersService.resendPhoneVerificationCode(
                req.user.userId,
                sendPhoneVerificationDto.phoneNumber,
                {
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            );

            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: (error as Error).message || 'Failed to resend verification code'
                },
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        try {
            await this.usersService.remove(id);
            return {
                statusCode: HttpStatus.NO_CONTENT,
                message: 'User removed successfully',
            };
        } catch (error) {
            throw new HttpException(
                { message: (error as Error).message || 'Error deleting user' },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
