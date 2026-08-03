import { UserRole, UserStatus } from '@foodwaste/shared';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

// eslint-disable-next-line import/no-restricted-paths
import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { PhoneNumberService } from '../common/services/phone-number.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/user.service';

import { AuthService } from './auth.service';
import { AuthSecurityService } from './services/auth-security.service';
import { CaptchaService } from './services/captcha.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { TokenService } from './services/token.service';

import type { LoginDto } from './DTO/login.dto';
import type { RegisterDto } from './DTO/register.dto';
import type { VerifyEmailDto } from './DTO/verify-email.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import type { TestingModule } from '@nestjs/testing';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let configService: ConfigService;
  let emailService: EmailService;
  let passwordPolicyService: PasswordPolicyService;
  let tokenService: TokenService;

  // Mock data for consistent testing
  const mockUserId = '507f1f77bcf86c0012345678';
  const mockUserEmail = 'test@example.com';
  const mockPassword = 'Test123!@#';
  const mockHashedPassword = '$2b$10$mockhashforpassword12345';
  const mockVerificationToken = 'mock_verification_token_12345';
  const mockAccessToken = 'mock.access.token';
  const mockRefreshToken = 'mock.refresh.token';

  // Helper function to create mock users with proper toObject implementation
  const createMockUser = (overrides: Record<string, unknown> = {}) => {
    const baseUserObject = {
      _id: mockUserId,
      id: mockUserId,
      email: mockUserEmail,
      password: mockHashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CONSUMER,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: false,
      phoneNumber: '+21620123456',
      refreshTokens: [],
      emailVerificationToken: mockVerificationToken,
      passwordResetToken: 'reset_token',
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      tokenRevocationVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    return {
      ...baseUserObject,
      toObject: jest.fn().mockReturnValue(baseUserObject),
    };
  };

  const mockUser = createMockUser();

  const mockRegisterDto: RegisterDto = {
    email: mockUserEmail,
    password: mockPassword,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+21620123456',
  };

  const mockVerifyEmailDto: VerifyEmailDto = {
    email: mockUserEmail,
    token: mockVerificationToken,
  };

  const mockLoginDto: LoginDto = {
    email: mockUserEmail,
    password: mockPassword,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findByEmailVerificationToken: jest.fn(),
            verifyEmail: jest.fn(),
            incrementFailedLoginAttempts: jest.fn(),
            resetFailedLoginAttempts: jest.fn(),
            updateLastLogin: jest.fn(),
            findOneWithTokens: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: {
            validatePasswordStrength: jest.fn(),
          },
        },
        {
          provide: PhoneNumberService,
          useValue: {
            validatePhoneNumber: jest.fn().mockImplementation((phone: string) => ({
              isValid: true,
              details: { formatted: { e164: phone } },
            })),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn().mockResolvedValue({
              accessToken: mockAccessToken,
              refreshToken: mockRefreshToken,
              jti: 'mock-jti',
              familyId: 'mock-family',
            }),
            revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
            validateRefreshToken: jest.fn(),
            rotateToken: jest.fn(),
            revokeFamilyTokens: jest.fn(),
          },
        },
        {
          provide: AuthSecurityService,
          useValue: {
            isIpBlocked: jest.fn().mockResolvedValue(false),
            detectSuspiciousActivity: jest.fn().mockResolvedValue(false),
            checkLoginAttempts: jest.fn().mockResolvedValue({ allowed: true }),
            recordFailedLoginAttempt: jest.fn().mockResolvedValue({
              currentAttempts: 1,
              maxAttempts: 5,
              attemptsRemaining: 4,
              isLocked: false,
            }),
            clearLoginAttempts: jest.fn().mockResolvedValue(undefined),
            blockIp: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CaptchaService,
          useValue: {
            verifyCaptcha: jest.fn().mockResolvedValue({ isValid: true }),
          },
        },
        {
          provide: EventBusService,
          useValue: {
            emit: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
    passwordPolicyService = module.get<PasswordPolicyService>(PasswordPolicyService);
    tokenService = module.get<TokenService>(TokenService);

    // Default mock implementations
    jest.spyOn(configService, 'get').mockReturnValue('mock-secret');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  describe('register', () => {
    describe('Positive Tests - Valid Registration', () => {
      it('should_RegisterUserSuccessfully_When_ValidDataProvided', async () => {
        // Arrange
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue(true);

        // Act
        const result = await service.register(mockRegisterDto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe(
          'Registration successful. Please check your email to verify your account before logging in.',
        );
        expect(result.user.userId).toBe(mockUserId);
        expect(result.user.email).toBe(mockUserEmail);
        expect(usersService.findByEmail).toHaveBeenCalledWith(mockUserEmail);
        expect(passwordPolicyService.validatePasswordStrength).toHaveBeenCalled();
        expect(usersService.create).toHaveBeenCalled();
        expect(emailService.sendVerificationEmail).toHaveBeenCalled();
      });

      it('should_RegisterUserWithMerchantRole_When_RoleProvided', async () => {
        // Arrange
        const merchantRegisterDto = { ...mockRegisterDto, role: UserRole.MERCHANT };
        const merchantUser = createMockUser({ role: UserRole.MERCHANT });
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(merchantUser as unknown as UserDocument);
        jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue(true);

        // Act
        const result = await service.register(merchantRegisterDto);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            role: UserRole.MERCHANT,
          }),
        );
      });

      it('should_RegisterSuccessfully_When_EmailServiceFails', async () => {
        // Arrange - Email service failure should not prevent registration
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest
          .spyOn(emailService, 'sendVerificationEmail')
          .mockRejectedValue(new Error('Email service down'));

        // Act
        const result = await service.register(mockRegisterDto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe(
          'Registration successful. Please check your email to verify your account before logging in.',
        );
      });
    });

    describe('Negative Tests - Invalid Registration', () => {
      it('should_ThrowConflictException_When_UserAlreadyExists', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);

        // Act & Assert
        await expect(service.register(mockRegisterDto)).rejects.toThrow(
          new ConflictException('User with this email already exists'),
        );
        expect(passwordPolicyService.validatePasswordStrength).not.toHaveBeenCalled();
        expect(usersService.create).not.toHaveBeenCalled();
      });

      it('should_ThrowError_When_PasswordPolicyValidationFails', async () => {
        // Arrange
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation(() => {
          throw new BadRequestException('Password does not meet security requirements');
        });

        // Act & Assert
        await expect(service.register(mockRegisterDto)).rejects.toThrow(BadRequestException);
        expect(usersService.create).not.toHaveBeenCalled();
      });

      it('should_RejectAdminRole_When_AdminRoleProvided', async () => {
        // Arrange
        const adminRegisterDto = { ...mockRegisterDto, role: UserRole.ADMIN };
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);

        // Act
        await service.register(adminRegisterDto);

        // Assert - Admin role should be ignored and default to CONSUMER
        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            role: UserRole.CONSUMER,
          }),
        );
      });
    });

    describe('Edge Cases - Registration Boundaries', () => {
      it('should_HandleMinimumValidInput_When_OnlyRequiredFieldsProvided', async () => {
        // Arrange
        const minimalRegisterDto = {
          email: 'min@test.com',
          password: 'Min123!@#',
          firstName: 'A',
          lastName: 'B',
          phoneNumber: '+21620123456',
        };
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);

        // Act
        const result = await service.register(minimalRegisterDto);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'min@test.com',
            role: UserRole.CONSUMER,
          }),
        );
      });

      it('should_HandleOptionalPhoneNumber_When_PhoneNumberProvided', async () => {
        // Arrange
        const phoneRegisterDto = { ...mockRegisterDto, phoneNumber: '+1234567890' };
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);

        // Act
        const result = await service.register(phoneRegisterDto);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            phoneNumber: '+1234567890',
          }),
        );
      });
    });

    describe('Exception Tests - System Failures', () => {
      it('should_ThrowError_When_DatabaseCreateFails', async () => {
        // Arrange
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);
        jest.spyOn(passwordPolicyService, 'validatePasswordStrength').mockImplementation();
        jest
          .spyOn(usersService, 'create')
          .mockRejectedValue(new Error('Database connection failed'));

        // Act & Assert
        await expect(service.register(mockRegisterDto)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should_ThrowError_When_DatabaseFindFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockRejectedValue(new Error('Database query failed'));

        // Act & Assert
        await expect(service.register(mockRegisterDto)).rejects.toThrow('Database query failed');
      });
    });
  });

  describe('verifyEmail', () => {
    describe('Positive Tests - Valid Email Verification', () => {
      it('should_VerifyEmailSuccessfully_When_ValidTokenProvided', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(mockUser as unknown as UserDocument);
        jest.spyOn(usersService, 'verifyEmail').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.verifyEmail(mockVerifyEmailDto);

        // Assert
        expect(result.message).toBe('Email verified successfully');
        expect(usersService.findByEmailVerificationToken).toHaveBeenCalledWith(
          mockVerificationToken,
          mockUserEmail,
        );
        expect(usersService.verifyEmail).toHaveBeenCalledWith(mockUserId);
        expect(result.tokens).toBeDefined();
      });

      it('should_VerifyEmailAndAutoLogin_When_ValidTokenProvided', async () => {
        // Arrange - verifyEmail now auto-logins the user with tokens
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(mockUser as unknown as UserDocument);
        jest.spyOn(usersService, 'verifyEmail').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.verifyEmail(mockVerifyEmailDto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Email verified successfully');
        expect(result.tokens).toBeDefined();
        expect(result.tokens?.accessToken).toBe(mockAccessToken);
        expect(tokenService.generateTokenPair).toHaveBeenCalled();
      });
    });

    describe('Negative Tests - Invalid Email Verification', () => {
      it('should_ThrowBadRequestException_When_InvalidTokenProvided', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.verifyEmail(mockVerifyEmailDto)).rejects.toThrow(
          new BadRequestException('Invalid or expired verification token'),
        );
        expect(usersService.verifyEmail).not.toHaveBeenCalled();
      });

      it('should_ThrowBadRequestException_When_ExpiredTokenProvided', async () => {
        // Arrange
        const invalidVerifyDto = { email: mockUserEmail, token: 'expired_token' };
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.verifyEmail(invalidVerifyDto)).rejects.toThrow(
          new BadRequestException('Invalid or expired verification token'),
        );
      });

      it('should_ThrowBadRequestException_When_WrongEmailProvided', async () => {
        // Arrange
        const wrongEmailDto = { email: 'wrong@email.com', token: mockVerificationToken };
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.verifyEmail(wrongEmailDto)).rejects.toThrow(
          new BadRequestException('Invalid or expired verification token'),
        );
      });
    });

    describe('Edge Cases - Verification Boundaries', () => {
      it('should_HandleEmptyToken_When_EmptyStringProvided', async () => {
        // Arrange
        const emptyTokenDto = { email: mockUserEmail, token: '' };
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.verifyEmail(emptyTokenDto)).rejects.toThrow(BadRequestException);
      });

      it('should_HandleSpecialCharactersInToken_When_InvalidTokenFormat', async () => {
        // Arrange
        const specialCharTokenDto = { email: mockUserEmail, token: 'invalid@#$%token' };
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.verifyEmail(specialCharTokenDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('Exception Tests - System Failures', () => {
      it('should_ThrowError_When_DatabaseFindFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockRejectedValue(new Error('Database connection failed'));

        // Act & Assert
        await expect(service.verifyEmail(mockVerifyEmailDto)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should_ThrowError_When_VerificationUpdateFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmailVerificationToken')
          .mockResolvedValue(mockUser as unknown as UserDocument);
        jest.spyOn(usersService, 'verifyEmail').mockRejectedValue(new Error('Update failed'));

        // Act & Assert
        await expect(service.verifyEmail(mockVerifyEmailDto)).rejects.toThrow('Update failed');
      });
    });
  });

  describe('login', () => {
    const mockRequestInfo = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      location: 'Test Location',
    };

    describe('Positive Tests - Valid Login', () => {
      it('should_LoginSuccessfully_When_ValidCredentialsProvided', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto, mockRequestInfo);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Login successful');
        expect(result.user).toBeDefined();
        expect(result.tokens).toBeDefined();

        const resultUser = result.user;
        const resultTokens = result.tokens;
        if (!resultUser || !resultTokens) {
          throw new Error('Expected login result to include user and tokens');
        }

        expect(resultUser.userId).toBe(mockUserId);
        expect(resultTokens.accessToken).toBe(mockAccessToken);
        expect(resultTokens.refreshToken).toBe(mockRefreshToken);
        expect(tokenService.generateTokenPair).toHaveBeenCalled();
        expect(usersService.resetFailedLoginAttempts).toHaveBeenCalledWith(mockUserId);
        expect(usersService.updateLastLogin).toHaveBeenCalledWith(
          mockUserId,
          '192.168.1.1',
          'Mozilla/5.0 Test Browser',
          'Test Location',
        );
      });

      it('should_LoginSuccessfully_When_NoRequestInfoProvided', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.updateLastLogin).toHaveBeenCalledWith(
          mockUserId,
          'unknown',
          'unknown',
          undefined,
        );
      });

      it('should_LoginSuccessfully_When_PartialRequestInfoProvided', async () => {
        // Arrange
        const partialRequestInfo = { ipAddress: '192.168.1.1' };
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto, partialRequestInfo);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.updateLastLogin).toHaveBeenCalledWith(
          mockUserId,
          '192.168.1.1',
          'unknown',
          undefined,
        );
      });
    });

    describe('Negative Tests - Invalid Login', () => {
      const getUnauthorizedLoginError = async (): Promise<UnauthorizedException> => {
        try {
          await service.login(mockLoginDto, mockRequestInfo);
        } catch (error: unknown) {
          if (error instanceof UnauthorizedException) {
            return error;
          }

          throw error;
        }

        throw new Error('Expected UnauthorizedException');
      };

      const getUnauthorizedResponse = (
        error: UnauthorizedException,
      ): { message?: string | string[]; type?: string } => {
        const response = error.getResponse();

        if (typeof response === 'string') {
          return { message: response };
        }

        return response as { message?: string | string[]; type?: string };
      };

      it('should_ThrowUnauthorizedException_When_UserNotFound', async () => {
        // Arrange
        jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null as unknown as UserDocument);

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should_ThrowUnauthorizedException_When_EmailNotVerified', async () => {
        // Arrange
        const unverifiedUser = createMockUser({ isEmailVerified: false });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(unverifiedUser as unknown as UserDocument);

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          new UnauthorizedException('Please verify your email before logging in'),
        );
      });

      it('should_ThrowUnauthorizedException_When_AccountLocked', async () => {
        // Arrange
        const lockedUser = createMockUser({
          accountLockedUntil: new Date(Date.now() + 60000), // 1 minute from now
        });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(lockedUser as unknown as UserDocument);

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should_ThrowUnauthorizedException_When_AccountSuspended', async () => {
        // Arrange
        const suspendedUser = createMockUser({ status: UserStatus.SUSPENDED });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(suspendedUser as unknown as UserDocument);

        // Act & Assert
        const error = await getUnauthorizedLoginError();
        const response = getUnauthorizedResponse(error);
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(response.message).toBe('Account is suspended');
        expect(response.type).toBe('ACCOUNT_SUSPENDED');
      });

      it('should_ThrowUnauthorizedException_When_AccountInactive', async () => {
        // Arrange
        const inactiveUser = createMockUser({ status: UserStatus.BLOCKED });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(inactiveUser as unknown as UserDocument);

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          'Your account is not currently active. Please contact support for assistance.',
        );
      });

      it('should_ThrowUnauthorizedException_When_InvalidPassword', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(false);
        jest.spyOn(usersService, 'incrementFailedLoginAttempts').mockResolvedValue(undefined);

        // Act & Assert
        const error = await getUnauthorizedLoginError();
        const response = getUnauthorizedResponse(error);
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(response.message).toBe('The password you entered is incorrect');
        expect(response.type).toBe('INVALID_PASSWORD');
        // Audit counter persisted to MongoDB
        expect(usersService.incrementFailedLoginAttempts).toHaveBeenCalledWith(
          mockUserId,
          '192.168.1.1',
          'Mozilla/5.0 Test Browser',
        );
      });

      it('should_LockAccount_When_TooManyFailedAttempts', async () => {
        // Arrange – lockout decision now comes from AuthSecurityService (Redis).
        // This test verifies the audit trail is still written on every failed attempt.
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(false);
        jest.spyOn(usersService, 'incrementFailedLoginAttempts').mockResolvedValue(undefined);

        // Act & Assert
        const error = await getUnauthorizedLoginError();
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(usersService.incrementFailedLoginAttempts).toHaveBeenCalledWith(
          mockUserId,
          '192.168.1.1',
          'Mozilla/5.0 Test Browser',
        );
      });
    });

    describe('Edge Cases - Login Boundaries', () => {
      it('should_HandleAccountLockExpiry_When_LockTimeExpired', async () => {
        // Arrange - Account was locked but lock time has expired
        const expiredLockUser = createMockUser({
          accountLockedUntil: new Date(Date.now() - 60000), // 1 minute ago
        });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(expiredLockUser as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);

        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto, mockRequestInfo);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should_HandleCaseInsensitiveEmail_When_DifferentCaseProvided', async () => {
        // Arrange
        const upperCaseLoginDto = { ...mockLoginDto, email: 'TEST@EXAMPLE.COM' };
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);

        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(upperCaseLoginDto, mockRequestInfo);

        // Assert
        expect(result.success).toBe(true);
        expect(usersService.findByEmail).toHaveBeenCalledWith('TEST@EXAMPLE.COM');
      });
    });

    describe('Exception Tests - System Failures', () => {
      it('should_ThrowError_When_DatabaseFindFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockRejectedValue(new Error('Database connection failed'));

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should_ThrowError_When_PasswordComparisonFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockRejectedValue(new Error('bcrypt error'));

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow('bcrypt error');
      });

      // Note: Token generation failure test removed due to complex mock interaction
      // The system properly handles token generation in practice

      it('should_ThrowError_When_TokenGenerationFails', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);
        jest
          .spyOn(tokenService, 'generateTokenPair')
          .mockRejectedValue(new Error('Token generation failed'));

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          'Token generation failed',
        );
      });
    });

    describe('Performance Tests - Timeout and Async Operations', () => {
      it('should_HandleTimeoutGracefully_When_DatabaseSlowResponse', async () => {
        // Arrange
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database timeout')), 100),
        );
        jest.spyOn(usersService, 'findByEmail').mockImplementation(async () => {
          const result = await (timeoutPromise as unknown as Promise<UserDocument>);
          return result;
        });

        // Act & Assert
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow(
          'Database timeout',
        );
      }, 5000);

      it('should_HandleConcurrentTokenGeneration_When_TokenServiceCalled', async () => {
        // Arrange
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);
        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Mock token service with realistic delay
        jest.spyOn(tokenService, 'generateTokenPair').mockImplementation(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          () =>
            new Promise(resolve =>
              setTimeout(
                () =>
                  resolve({
                    accessToken: mockAccessToken,
                    refreshToken: mockRefreshToken,
                    jti: 'mock-jti',
                    familyId: 'mock-family',
                  }),
                50,
              ),
            ),
        );

        // Act
        const result = await service.login(mockLoginDto, mockRequestInfo);

        // Assert
        expect(result.success).toBe(true);
        expect(tokenService.generateTokenPair).toHaveBeenCalledTimes(1);
      }, 10000);
    });

    describe('Regression Tests - Previously Found Bugs', () => {
      it('should_NotExposePassword_When_UserObjectReturned', async () => {
        // Arrange - Regression test for password exposure
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);

        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto, mockRequestInfo);

        // Assert
        expect(result.user).not.toHaveProperty('password');
        expect(result.user).not.toHaveProperty('refreshTokens');
        expect(result.user).not.toHaveProperty('emailVerificationToken');
        expect(result.user).not.toHaveProperty('passwordResetToken');
      });

      it('should_HandleMissingToObjectMethod_When_UserDocumentLacksMethod', async () => {
        // Arrange - Regression test for missing toObject method
        const userWithoutToObject = { ...mockUser };
        delete (userWithoutToObject as { toObject?: jest.Mock }).toObject;
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(userWithoutToObject as unknown as UserDocument);

        // Act & Assert - Should handle gracefully without crashing
        await expect(service.login(mockLoginDto, mockRequestInfo)).rejects.toThrow();
      });

      it('should_HandleNullAccountLockedUntil_When_NeverLocked', async () => {
        // Arrange - Regression test for null accountLockedUntil handling
        const userNeverLocked = createMockUser({ accountLockedUntil: null });
        jest
          .spyOn(usersService, 'findByEmail')
          .mockResolvedValue(userNeverLocked as unknown as UserDocument);
        (argon2.verify as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'resetFailedLoginAttempts').mockResolvedValue(undefined);

        jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

        // Act
        const result = await service.login(mockLoginDto, mockRequestInfo);

        // Assert
        expect(result.success).toBe(true);
      });
    });
  });

  // =================================================================
  // refreshTokens — THE critical flow for session continuity
  // This is the exact code path that runs on every POST /auth/refresh
  // =================================================================
  describe('refreshTokens', () => {
    const mockRefreshTokenStr = 'valid.refresh.token';
    const mockRequestInfo = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

    describe('Positive Tests — successful refresh', () => {
      it('should return new token pair on valid refresh', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'old-jti',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        const result = await service.refreshTokens(
          mockUserId,
          mockRefreshTokenStr,
          mockRequestInfo,
        );

        expect(result.accessToken).toBe(mockAccessToken);
        expect(result.refreshToken).toBe(mockRefreshToken);
        expect(result.expiresIn).toBe(900);
        expect(result.tokenType).toBe('Bearer');
      });

      it('should rotate old token before generating new pair', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'old-jti',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr, mockRequestInfo);

        expect(tokenService.rotateToken).toHaveBeenCalledWith('old-jti');
        expect(tokenService.generateTokenPair).toHaveBeenCalled();

        // rotateToken must be called before generateTokenPair
        const rotateOrder =
          (tokenService.rotateToken as jest.Mock).mock.invocationCallOrder[0] ?? 0;
        const generateOrder =
          (tokenService.generateTokenPair as jest.Mock).mock.invocationCallOrder[0] ?? 0;
        expect(rotateOrder).toBeLessThan(generateOrder);
      });

      it('should generate new tokens in the same family with parent JTI link', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'old-jti-123',
          familyId: 'family-abc',
          rememberMe: true,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr, mockRequestInfo);

        expect(tokenService.generateTokenPair).toHaveBeenCalledWith(
          mockUserId,
          mockUserEmail,
          UserRole.CONSUMER,
          expect.objectContaining({
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent/1.0',
          }),
          'old-jti-123', // parent JTI
          'family-abc', // same family
          0, // tokenRevocationVersion
          true, // rememberMe preserved
          false, // requiresPasswordChange
          undefined, // organizationId
          undefined, // assignedEstablishmentId
        );
      });

      it('should preserve rememberMe=false across rotation', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        const generateCall = (tokenService.generateTokenPair as jest.Mock).mock.calls[0];
        expect(generateCall[7]).toBe(false); // rememberMe=false preserved (8th arg)
      });

      it('should pass user tokenRevocationVersion to generateTokenPair', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ tokenRevocationVersion: 5 }) as unknown as UserDocument,
          );
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        const generateCall = (tokenService.generateTokenPair as jest.Mock).mock.calls[0];
        expect(generateCall[6]).toBe(5); // tokenRevocationVersion (7th arg)
      });
    });

    describe('Negative Tests — refresh must fail', () => {
      it('should throw UnauthorizedException when userId is empty', async () => {
        await expect(service.refreshTokens('', mockRefreshTokenStr)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException when refreshToken is empty', async () => {
        await expect(service.refreshTokens(mockUserId, '')).rejects.toThrow(UnauthorizedException);
      });

      it('should throw UnauthorizedException when user not found', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(null as unknown as UserDocument);

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          UnauthorizedException,
        );

        // Must NOT reveal that user doesn't exist
        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          'Session expired. Please log in again.',
        );
      });

      it('should throw UnauthorizedException when user status is SUSPENDED', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ status: UserStatus.SUSPENDED }) as unknown as UserDocument,
          );

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          'Account is no longer active',
        );
      });

      it('should throw UnauthorizedException when user status is BLOCKED', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ status: UserStatus.BLOCKED }) as unknown as UserDocument,
          );

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          'Account is no longer active',
        );
      });

      it('should throw UnauthorizedException when user status is DELETED', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ status: UserStatus.DELETED }) as unknown as UserDocument,
          );

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          'Account is no longer active',
        );
      });

      it('should throw UnauthorizedException when token validation fails', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: false,
          error: 'Token has expired',
        });

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          UnauthorizedException,
        );

        // Should NOT generate new tokens
        expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
      });

      it('should throw when token validation returns missing JTI', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          // jti is undefined
          familyId: 'fam-1',
          rememberMe: false,
        });

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          'Invalid refresh token: missing JTI',
        );
      });
    });

    describe('Security — token theft detection', () => {
      it('should revoke entire family when token reuse is detected', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: false,
          error: 'Token reuse detected',
          shouldRevokeFamily: true,
          familyId: 'compromised-family',
        });
        jest.spyOn(tokenService, 'revokeFamilyTokens').mockResolvedValue(3);

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(tokenService.revokeFamilyTokens).toHaveBeenCalledWith(
          'compromised-family',
          'Token reuse detected - possible theft',
        );
      });

      it('should NOT revoke family when validation fails without theft flag', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: false,
          error: 'Token has expired',
          // shouldRevokeFamily is NOT set
        });

        await expect(service.refreshTokens(mockUserId, mockRefreshTokenStr)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(tokenService.revokeFamilyTokens).not.toHaveBeenCalled();
      });

      it('should pass user lastTokenInvalidation to validateRefreshToken', async () => {
        const lastInvalidation = new Date('2026-01-15T00:00:00Z');
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ lastTokenInvalidation: lastInvalidation }) as unknown as UserDocument,
          );
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(
          mockRefreshTokenStr,
          lastInvalidation,
          0,
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle null tokenRevocationVersion gracefully (default to 0)', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(
            createMockUser({ tokenRevocationVersion: null }) as unknown as UserDocument,
          );
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        // Should pass 0 as version, not null
        const validateCall = (tokenService.validateRefreshToken as jest.Mock).mock.calls[0];
        expect(validateCall[0]).toBe(mockRefreshTokenStr);
        expect(validateCall[2]).toBe(0); // version defaults to 0
      });

      it('should handle undefined rememberMe from validation (default to false)', async () => {
        jest
          .spyOn(usersService, 'findOneWithTokens')
          .mockResolvedValue(createMockUser() as unknown as UserDocument);
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          // rememberMe is undefined (legacy token)
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        const generateCall = (tokenService.generateTokenPair as jest.Mock).mock.calls[0];
        expect(generateCall[7]).toBe(false); // should default to false, not undefined (8th arg)
      });

      it('should include organizationId and assignedEstablishmentId for merchant users', async () => {
        jest.spyOn(usersService, 'findOneWithTokens').mockResolvedValue(
          createMockUser({
            role: UserRole.MERCHANT,
            organizationId: 'org-123',
            assignedEstablishmentId: 'est-456',
          }) as unknown as UserDocument,
        );
        jest.spyOn(tokenService, 'validateRefreshToken').mockResolvedValue({
          isValid: true,
          userId: mockUserId,
          jti: 'jti-1',
          familyId: 'fam-1',
          rememberMe: false,
        });
        jest.spyOn(tokenService, 'rotateToken').mockResolvedValue(true);

        await service.refreshTokens(mockUserId, mockRefreshTokenStr);

        expect(tokenService.generateTokenPair).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          UserRole.MERCHANT,
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          'org-123',
          'est-456',
        );
      });
    });
  });

  // =================================================================
  // validateRefreshToken (auth.service wrapper) — lightweight JWT decode
  // This is the pre-check called by the controller before refreshTokens
  // =================================================================
  describe('validateRefreshToken (controller pre-check)', () => {
    it('should return userId when JWT is valid', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('jwt-refresh-secret');

      const mockJwtService = service['jwtService'] as unknown as { verifyAsync: jest.Mock };
      mockJwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-123' });

      const result = await service.validateRefreshToken('valid.jwt.token');

      expect(result).toEqual({ userId: 'user-123' });
    });

    it('should return null when JWT verification fails', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('jwt-refresh-secret');

      const mockJwtService = service['jwtService'] as unknown as { verifyAsync: jest.Mock };
      mockJwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('jwt expired'));

      const result = await service.validateRefreshToken('expired.jwt.token');

      expect(result).toBeNull();
    });

    it('should return null when sub claim is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('jwt-refresh-secret');

      const mockJwtService = service['jwtService'] as unknown as { verifyAsync: jest.Mock };
      mockJwtService.verifyAsync = jest.fn().mockResolvedValue({ jti: 'some-jti' });

      const result = await service.validateRefreshToken('no-sub.jwt.token');

      expect(result).toBeNull();
    });

    it('should use JWT_REFRESH_SECRET (not JWT_SECRET) for verification', async () => {
      const getSpy = jest.spyOn(configService, 'get');
      getSpy.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') {
          return 'refresh-secret-value';
        }
        if (key === 'JWT_SECRET') {
          return 'access-secret-value';
        }
        return undefined;
      });

      const mockJwtService = service['jwtService'] as unknown as { verifyAsync: jest.Mock };
      mockJwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-1' });

      await service.validateRefreshToken('any.token');

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'any.token',
        expect.objectContaining({ secret: 'refresh-secret-value' }),
      );
    });
  });
});
