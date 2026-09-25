import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { PasswordHistoryService } from '../../auth/services/password-history.service';
import { PasswordPolicyService } from '../../auth/services/password-policy.service';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { PhoneNumberService } from '../../common/services/phone-number.service';
import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import { SmsNotificationService } from '../../notifications/services/sms-notification.service';
import { User, UserRole, UserStatus } from '../schemas/user.schema';
import { UsersService } from '../user.service';

import type { CreateUserDto } from '../DTO/create-user.dto';
import type { UserDocument } from '../schemas/user.schema';
import type { TestingModule } from '@nestjs/testing';
import type { Model } from 'mongoose';

import { appError } from '../../common/errors';
// Mock argon2 module
jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('UsersService - create method', () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let logger: jest.Mocked<Logger>;

  // Mock data for testing
  const mockValidCreateUserDto: CreateUserDto = {
    email: 'test@example.com',
    password: 'ValidPassword123!',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+21612345678',
    role: UserRole.CONSUMER,
  };

  const mockAuditData = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  const mockHashedPassword = '$argon2id$v=19$m=65536,t=3,p=1$mockhashedpassword';

  let mockSavedUser: Record<string, unknown>;

  const createMockUser = (overrides: Record<string, unknown> = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: mockHashedPassword,
    role: UserRole.CONSUMER,
    status: UserStatus.PENDING,
    failedLoginAttempts: 0,
    loginHistory: [],
    auditLog: [],
    privacySettings: {
      tunisianCompliance: {
        dataProcessingConsent: false,
        locationTrackingConsent: false,
        communicationConsent: false,
      },
      internationalCompliance: {
        marketingOptIn: false,
        analyticsOptIn: false,
        thirdPartySharing: false,
        profilingOptIn: false,
        cookiesConsent: false,
        gdprConsentGiven: false,
        ccpaOptOutRequested: false,
      },
      consentRecords: [],
      dataSubjectRights: {
        dataPortabilityRequested: false,
        deletionRequested: false,
        restrictionRequested: false,
        objectionRequested: false,
        pendingRequests: [],
      },
    },
    save: jest.fn().mockResolvedValue(this),
    ...overrides,
  });

  beforeEach(async () => {
    // Reset mock user for each test
    mockSavedUser = createMockUser();

    // Create testing module with all required dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: Object.assign(
            jest.fn().mockImplementation(userData => {
              const user = createMockUser(userData);
              user.save = jest.fn().mockResolvedValue(user);
              return user;
            }),
            {
              findOne: jest.fn(),
            },
          ),
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: {
            validatePassword: jest.fn().mockReturnValue({
              score: 4,
              feedback: [],
              isValid: true,
              suggestions: [],
              crackTime: '10^10 years',
              guessesLog10: 10,
            }),
          },
        },
        {
          provide: PhoneNumberService,
          useValue: {
            validatePhoneNumber: jest.fn().mockReturnValue({
              isValid: true,
              details: { formatted: { e164: '+21612345678' } },
            }),
          },
        },
        {
          provide: SmsNotificationService,
          useValue: { sendVerificationCode: jest.fn().mockResolvedValue({ success: true }) },
        },
        {
          provide: PasswordHistoryService,
          useValue: {
            validatePasswordHistory: jest.fn().mockResolvedValue(undefined),
            addToHistory: jest.fn().mockReturnValue([]),
            isHistoryEnforced: jest.fn().mockReturnValue(false),
            getPasswordHistoryCount: jest.fn().mockReturnValue(5),
          },
        },
        {
          provide: EventBusService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RegexSecurityUtil,
          useValue: { escapeRegexPattern: jest.fn((s: string) => s) },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name)) as jest.Mocked<
      Model<UserDocument>
    >;
    // Spy on the service's internal logger
    logger = service['logger'] as unknown as jest.Mocked<Logger>;
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();

    // Setup default mocks
    mockedArgon2.hash.mockResolvedValue(mockHashedPassword);
    userModel.findOne.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  describe('Positive Tests - Valid inputs producing expected outputs', () => {
    it('should_CreateUserSuccessfully_When_ValidDataProvided', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(result.firstName).toBe(createUserDto.firstName);
      expect(result.lastName).toBe(createUserDto.lastName);
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: createUserDto.email,
        deletedAt: null,
      });
      expect(mockedArgon2.hash).toHaveBeenCalledWith(createUserDto.password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(`User created successfully: ${createUserDto.email}`),
      );
    });

    it('should_CreateUserWithAuditData_When_AuditDataProvided', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const auditData = { ...mockAuditData };

      // Act
      const result = await service.create(createUserDto, auditData);

      // Assert
      expect(result).toBeDefined();
      expect(result.auditLog).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'USER_CREATED',
            ipAddress: auditData.ipAddress,
            userAgent: auditData.userAgent,
            details: expect.objectContaining({ registrationMethod: 'standard' }),
          }),
        ]),
      );
    });

    it('should_CreateUserWithDefaultPrivacySettings_When_NoPrivacySettingsProvided', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result.privacySettings).toEqual({
        tunisianCompliance: {
          dataProcessingConsent: false,
          locationTrackingConsent: false,
          communicationConsent: false,
        },
        internationalCompliance: {
          marketingOptIn: false,
          analyticsOptIn: false,
          thirdPartySharing: false,
          profilingOptIn: false,
          cookiesConsent: false,
          gdprConsentGiven: false,
          ccpaOptOutRequested: false,
        },
        consentRecords: [],
        dataSubjectRights: {
          dataPortabilityRequested: false,
          deletionRequested: false,
          restrictionRequested: false,
          objectionRequested: false,
          pendingRequests: [],
        },
      });
    });

    it('should_CreateUserWithOptionalFields_When_OptionalFieldsProvided', async () => {
      // Arrange
      const createUserDto = {
        ...mockValidCreateUserDto,
        emailVerificationToken: 'test-token-123',
        profileImage: 'https://example.com/profile.jpg',
      };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
    });
  });

  describe('Negative Tests - Invalid inputs and error handling', () => {
    it('should_ThrowBadRequestException_When_EmailIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('EMAIL_REQUIRED')),
      );
    });

    it('should_ThrowBadRequestException_When_EmailIsUndefined', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto } as Partial<CreateUserDto>;
      delete createUserDto.email;

      // Act & Assert
      await expect(service.create(createUserDto as CreateUserDto)).rejects.toThrow(
        new BadRequestException(appError('EMAIL_REQUIRED')),
      );
    });

    it('should_ThrowBadRequestException_When_PasswordIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, password: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('PASSWORD_REQUIRED')),
      );
    });

    it('should_ThrowBadRequestException_When_FirstNameIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, firstName: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('FIRST_NAME_REQUIRED')),
      );
    });

    it('should_ThrowBadRequestException_When_LastNameIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, lastName: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('LAST_NAME_REQUIRED')),
      );
    });

    it('should_ThrowConflictException_When_UserWithEmailAlreadyExists', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const existingUser = { email: createUserDto.email, deletedAt: null };
      userModel.findOne.mockResolvedValue(existingUser as unknown as UserDocument);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new ConflictException(appError('EMAIL_ALREADY_REGISTERED')),
      );
    });
  });

  describe('Edge Cases - Boundary conditions and special scenarios', () => {
    it('should_HandleWhitespaceOnlyFields_When_FieldsContainOnlySpaces', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: '   ' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('EMAIL_REQUIRED')),
      );
    });

    it('should_CreateUser_When_MinimalValidDataProvided', async () => {
      // Arrange
      const minimalCreateUserDto = {
        email: 'minimal@test.com',
        password: 'MinimalPass123!',
        firstName: 'A',
        lastName: 'B',
      };

      // Act
      const result = await service.create(minimalCreateUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.firstName).toBe('A');
      expect(result.lastName).toBe('B');
    });

    it('should_CreateUser_When_NoAuditDataProvided', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.auditLog).toEqual([]);
    });
  });

  describe('Exception Tests - Error throwing and system errors', () => {
    it('should_ThrowBadRequestException_When_PasswordHashingFails', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      mockedArgon2.hash.mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(appError('ACCOUNT_CREATE_FAILED')),
      );
      expect(logger.error).toHaveBeenCalledWith(
        `User creation failed for email: ${createUserDto.email}`,
        expect.any(String),
      );
    });

    it('should_ThrowBadRequestException_When_DatabaseSaveFails', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const modelMock = userModel as unknown as jest.Mock;
      modelMock.mockImplementationOnce((userData: Record<string, unknown>) => {
        const user = createMockUser(userData);
        user.save = jest.fn().mockRejectedValue(new Error('Database save failed'));
        return user;
      });

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
    });

    it('should_RethrowValidationErrors_When_ConflictExceptionOccurs', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      userModel.findOne.mockResolvedValue(mockSavedUser);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should_RethrowValidationErrors_When_BadRequestExceptionOccurs', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('State Tests - Object state changes and mutations', () => {
    it('should_InitializeFailedLoginAttemptsToZero_When_UserCreated', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result.failedLoginAttempts).toBe(0);
    });

    it('should_InitializeEmptyLoginHistory_When_UserCreated', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result.loginHistory).toEqual([]);
    });

    it('should_HashPasswordWithArgon2_When_UserCreated', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      await service.create(createUserDto);

      // Assert
      expect(mockedArgon2.hash).toHaveBeenCalledWith(createUserDto.password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 2 ** 16
        timeCost: 3,
        parallelism: 1,
      });
    });
  });

  describe('Integration Points - Mock external dependencies verification', () => {
    it('should_CheckExistingUserCorrectly_When_DatabaseQueryExecuted', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      await service.create(createUserDto);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledTimes(2);
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: createUserDto.email.toLowerCase(),
        deletedAt: null,
      });
    });

    it('should_CallSaveMethodOnUserModel_When_UserCreated', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const saveMock = jest.fn().mockResolvedValue(createMockUser());
      const modelMock = userModel as unknown as jest.Mock;
      modelMock.mockImplementationOnce((userData: Record<string, unknown>) => {
        const user = createMockUser(userData);
        user.save = saveMock;
        return user;
      });

      // Act
      await service.create(createUserDto);

      // Assert
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('should_LogSuccessMessage_When_UserCreatedSuccessfully', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      await service.create(createUserDto);

      // Assert
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(`User created successfully: ${createUserDto.email}`),
      );
    });
  });

  describe('Performance Tests - Async operations and timeouts', () => {
    it('should_CompleteWithinReasonableTime_When_ValidDataProvided', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const startTime = Date.now();

      // Act
      await service.create(createUserDto);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should_HandleConcurrentCreationAttempts_When_MultipleCallsMade', async () => {
      // Arrange
      const createUserDto1 = { ...mockValidCreateUserDto, email: 'user1@test.com' };
      const createUserDto2 = { ...mockValidCreateUserDto, email: 'user2@test.com' };

      // Act
      const promises = [service.create(createUserDto1), service.create(createUserDto2)];
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });
  });

  describe('Regression Tests - Previously found issues', () => {
    it('should_NotLeakSensitiveDataInErrors_When_SystemErrorOccurs', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const sensitiveError = new Error(
        'Database connection string: mongodb://admin:secret@localhost',
      );
      const modelMock = userModel as unknown as jest.Mock;
      modelMock.mockImplementationOnce((userData: Record<string, unknown>) => {
        const user = createMockUser(userData);
        user.save = jest.fn().mockRejectedValue(sensitiveError);
        return user;
      });

      // Act & Assert
      const thrownError = (await service.create(createUserDto).catch((err: Error) => err)) as Error;
      expect(thrownError).toBeInstanceOf(BadRequestException);
      expect(thrownError.message).not.toContain('secret');
      expect(thrownError.message).not.toContain('mongodb://');
    });

    it('should_HandleNullCreateUserDto_When_NullDataProvided', async () => {
      // Arrange
      const createUserDto = null as unknown as CreateUserDto;

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
    });

    it('should_HandleUndefinedCreateUserDto_When_UndefinedDataProvided', async () => {
      // Arrange
      const createUserDto = undefined as unknown as CreateUserDto;

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
    });
  });
});
