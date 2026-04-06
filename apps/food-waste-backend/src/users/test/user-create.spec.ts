import { BadRequestException, ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { User, UserRole, UserStatus } from '../schemas/user.schema';
import { PasswordValidationService } from '../services/password-validation.service';
import { UsersService } from '../user.service';

import type { CreateUserDto } from '../DTO/create-user.dto';
import type { UserDocument } from '../schemas/user.schema';
import type { TestingModule } from '@nestjs/testing';

// Mock argon2 module
jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('UsersService - create method', () => {
  let service: UsersService;
  type MockModelFn = jest.MockedFunction<
    (data: Record<string, unknown>) => { save: jest.Mock; [key: string]: unknown }
  > & { findOne: jest.Mock };
  let mockUserModel: MockModelFn;
  let mockPasswordValidationService: jest.Mocked<PasswordValidationService>;
  let loggerSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

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

  beforeEach(async () => {
    const createMockUser = (overrides = {}) => ({
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
      save: jest.fn(),
      ...overrides,
    });

    // Mock user model constructor and methods
    mockUserModel = jest.fn().mockImplementation((userData) => {
      const user = createMockUser(userData);
      user.save = jest.fn().mockResolvedValue(user);
      return user;
    }) as unknown as MockModelFn;
    mockUserModel.findOne = jest.fn();

    // Mock PasswordValidationService
    mockPasswordValidationService = {
      validatePassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordValidationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: PasswordValidationService,
          useValue: mockPasswordValidationService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Setup logger spies
    loggerSpy = jest.spyOn(service['logger'], 'log');
    errorSpy = jest.spyOn(service['logger'], 'error');

    // Setup default mocks
    mockedArgon2.hash.mockResolvedValue(mockHashedPassword);
    mockUserModel.findOne.mockResolvedValue(null);

    // Setup default password validation response
    mockPasswordValidationService.validatePassword.mockResolvedValue({
      score: 4,
      feedback: [],
      warning: '',
      isAcceptable: true,
      crackTimeDisplay: '10^10 years',
      requirements: {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumbers: true,
        hasSpecialChars: true,
        noCommonPatterns: true,
        notInPasswordHistory: true,
        notSimilarToPersonalInfo: true,
      },
    });
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
      expect(result.email).toBe(createUserDto.email.toLowerCase()); // Check email normalization
      expect(result.firstName).toBe(createUserDto.firstName);
      expect(result.lastName).toBe(createUserDto.lastName);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: createUserDto.email.toLowerCase(),
        deletedAt: null,
      });
      expect(mockPasswordValidationService.validatePassword).toHaveBeenCalledWith(
        createUserDto.password,
        expect.objectContaining({
          email: createUserDto.email.toLowerCase(),
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
        }),
      );
      expect(mockedArgon2.hash).toHaveBeenCalledWith(createUserDto.password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`User created successfully: ${createUserDto.email.toLowerCase()}`),
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
            details: expect.objectContaining({
              registrationMethod: 'standard',
              passwordStrength: 4,
              emailNormalized: true,
            }),
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
        new BadRequestException('Email is required and cannot be empty'),
      );
    });

    it('should_ThrowBadRequestException_When_EmailIsUndefined', async () => {
      // Arrange
      const createUserDto: Partial<CreateUserDto> = { ...mockValidCreateUserDto };
      delete createUserDto.email;

      // Act & Assert
      await expect(service.create(createUserDto as CreateUserDto)).rejects.toThrow(
        new BadRequestException('Email is required and cannot be empty'),
      );
    });

    it('should_ThrowBadRequestException_When_PasswordIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, password: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('Password is required and cannot be empty'),
      );
    });

    it('should_ThrowBadRequestException_When_FirstNameIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, firstName: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('First name is required and cannot be empty'),
      );
    });

    it('should_ThrowBadRequestException_When_LastNameIsEmpty', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, lastName: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('Last name is required and cannot be empty'),
      );
    });

    it('should_ThrowConflictException_When_UserWithEmailAlreadyExists', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const existingUser = { email: createUserDto.email.toLowerCase(), deletedAt: null };
      mockUserModel.findOne.mockResolvedValue(existingUser as unknown as UserDocument);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );
    });

    it('should_ThrowBadRequestException_When_PasswordIsWeak', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, password: 'weak' };
      mockPasswordValidationService.validatePassword.mockResolvedValue({
        score: 1,
        feedback: ['Password is too short', 'Add more characters'],
        warning: 'Very weak password',
        isAcceptable: false,
        crackTimeDisplay: '1 minute',
        requirements: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: true,
          hasNumbers: false,
          hasSpecialChars: false,
          noCommonPatterns: true,
          notInPasswordHistory: true,
          notSimilarToPersonalInfo: true,
        },
      });

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException(
          'Password validation failed: Password is too short, Add more characters',
        ),
      );
    });
  });

  describe('Edge Cases - Boundary conditions and special scenarios', () => {
    it('should_HandleWhitespaceOnlyFields_When_FieldsContainOnlySpaces', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: '   ' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('Email is required and cannot be empty'),
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

      // Update mock to return the specific data for this test
      mockUserModel.mockImplementationOnce((userData: Record<string, unknown>) => ({
        ...userData,
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
        save: jest.fn().mockResolvedValue({
          ...userData,
          firstName: 'A',
          lastName: 'B',
        }),
      }));

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

    it('should_NormalizeEmailToLowercase_When_EmailHasUppercaseCharacters', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: 'TEST@Example.COM' };

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result.email).toBe('test@example.com');
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        deletedAt: null,
      });
    });
  });

  describe('Exception Tests - Error throwing and system errors', () => {
    it('should_ThrowBadRequestException_When_PasswordHashingFails', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      mockedArgon2.hash.mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('User creation failed due to system error'),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        `User creation failed for email: ${createUserDto.email}`,
        expect.any(String),
      );
    });

    it('should_ThrowBadRequestException_When_DatabaseSaveFails', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      mockUserModel.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database save failed')),
      }));

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('User creation failed due to system error'),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        `User creation failed for email: ${createUserDto.email}`,
        expect.any(String),
      );
    });

    it('should_RethrowValidationErrors_When_ConflictExceptionOccurs', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      const existingUser = { email: createUserDto.email, deletedAt: null };
      mockUserModel.findOne.mockResolvedValue(existingUser as unknown as UserDocument);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should_RethrowValidationErrors_When_BadRequestExceptionOccurs', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto, email: '' };

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
      expect(errorSpy).not.toHaveBeenCalled();
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
      expect(mockUserModel.findOne).toHaveBeenCalledTimes(1);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: createUserDto.email,
        deletedAt: null,
      });
    });

    it('should_CallSaveMethodOnUserModel_When_UserCreated', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };
      let savedUser: { save: jest.Mock } | undefined;
      mockUserModel.mockImplementationOnce((userData: Record<string, unknown>) => {
        const user = {
          ...userData,
          save: jest.fn().mockResolvedValue(userData),
        };
        savedUser = user;
        return user;
      });

      // Act
      await service.create(createUserDto);

      // Assert
      expect(savedUser).toBeDefined();
      if (!savedUser) {
        throw new Error('Expected saved user mock to be created');
      }
      expect(savedUser.save).toHaveBeenCalledTimes(1);
    });

    it('should_LogSuccessMessage_When_UserCreatedSuccessfully', async () => {
      // Arrange
      const createUserDto = { ...mockValidCreateUserDto };

      // Act
      await service.create(createUserDto);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`User created successfully: ${createUserDto.email.toLowerCase()}`),
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
      mockUserModel.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue(sensitiveError),
      }));

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BadRequestException('User creation failed due to system error'),
      );

      // Verify sensitive data is not exposed
      try {
        await service.create(createUserDto);
      } catch (error: unknown) {
        expect((error as Error).message).not.toContain('secret');
        expect((error as Error).message).not.toContain('mongodb://');
      }
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
