import { UserRole, UserStatus } from '@foodwaste/shared';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { UsersService } from '../../users/user.service';
import { JwtStrategy } from '../strategies/jwt.strategie';

import type { JwtPayload } from '../strategies/jwt.strategie';
import type { TestingModule } from '@nestjs/testing';

const MOCK_USER_ID = '507f1f77bcf86cd799439011';
const MOCK_EMAIL = 'test@example.com';
const MOCK_ORG_ID = '607f1f77bcf86cd799439022';
const MOCK_ESTABLISHMENT_ID = '707f1f77bcf86cd799439033';

const createActiveUser = (overrides: Record<string, unknown> = {}) => ({
  _id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  role: UserRole.CONSUMER,
  status: UserStatus.ACTIVE,
  ...overrides,
});

describe('JwtStrategy.validate()', () => {
  let strategy: JwtStrategy;
  let usersService: { findByEmail: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn().mockResolvedValue(createActiveUser()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-jwt-secret-key'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  const basePayload: JwtPayload = {
    sub: MOCK_USER_ID,
    email: MOCK_EMAIL,
    role: UserRole.CONSUMER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  describe('payload shape — userId mapping', () => {
    it('should map payload.sub to userId (not _id, id, or sub)', async () => {
      const result = await strategy.validate(basePayload);

      expect(result).toHaveProperty('userId', MOCK_USER_ID);
      expect(result).not.toHaveProperty('_id');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('sub');
    });

    it('should return email directly from payload', async () => {
      const result = await strategy.validate(basePayload);
      expect(result).toHaveProperty('email', MOCK_EMAIL);
    });

    it('should return role directly from payload', async () => {
      const result = await strategy.validate(basePayload);
      expect(result).toHaveProperty('role', UserRole.CONSUMER);
    });

    it('should NOT include iat or exp in returned object', async () => {
      const result = await strategy.validate(basePayload);
      expect(result).not.toHaveProperty('iat');
      expect(result).not.toHaveProperty('exp');
    });

    it('should return exactly { userId, email, role } for consumer', async () => {
      const result = await strategy.validate(basePayload);
      expect(Object.keys(result)).toEqual(['userId', 'email', 'role']);
    });
  });

  describe('optional fields — conditional spread', () => {
    it('should include organizationId when present in payload', async () => {
      const payload = { ...basePayload, organizationId: MOCK_ORG_ID };
      usersService.findByEmail.mockResolvedValue(createActiveUser({ role: UserRole.MERCHANT }));

      const result = await strategy.validate(payload);
      expect(result).toHaveProperty('organizationId', MOCK_ORG_ID);
    });

    it('should include assignedEstablishmentId when present in payload', async () => {
      const payload = { ...basePayload, assignedEstablishmentId: MOCK_ESTABLISHMENT_ID };
      usersService.findByEmail.mockResolvedValue(createActiveUser({ role: UserRole.MERCHANT }));

      const result = await strategy.validate(payload);
      expect(result).toHaveProperty('assignedEstablishmentId', MOCK_ESTABLISHMENT_ID);
    });

    it('should NOT include organizationId key when absent from payload', async () => {
      const result = await strategy.validate(basePayload);
      expect(result).not.toHaveProperty('organizationId');
      expect(Object.keys(result)).not.toContain('organizationId');
    });

    it('should NOT include assignedEstablishmentId key when absent', async () => {
      const result = await strategy.validate(basePayload);
      expect(Object.keys(result)).not.toContain('assignedEstablishmentId');
    });

    it('should include both optional fields for merchant with establishment', async () => {
      const payload = {
        ...basePayload,
        organizationId: MOCK_ORG_ID,
        assignedEstablishmentId: MOCK_ESTABLISHMENT_ID,
      };
      usersService.findByEmail.mockResolvedValue(createActiveUser({ role: UserRole.MERCHANT }));

      const result = await strategy.validate(payload);
      expect(Object.keys(result).sort()).toEqual([
        'assignedEstablishmentId',
        'email',
        'organizationId',
        'role',
        'userId',
      ]);
    });
  });

  describe('user status checks', () => {
    it('should throw UnauthorizedException when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue(
        createActiveUser({ status: UserStatus.SUSPENDED }),
      );

      await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is soft-deleted', async () => {
      usersService.findByEmail.mockResolvedValue(createActiveUser({ status: UserStatus.DELETED }));

      await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should look up user by email from JWT payload', async () => {
      await strategy.validate(basePayload);
      expect(usersService.findByEmail).toHaveBeenCalledWith(MOCK_EMAIL);
    });
  });

  describe('role variants', () => {
    const roles = [UserRole.CONSUMER, UserRole.MERCHANT, UserRole.ADMIN, UserRole.MODERATOR];

    it.each(roles)('should pass through role %s from payload', async role => {
      const payload = { ...basePayload, role };
      usersService.findByEmail.mockResolvedValue(createActiveUser({ role }));

      const result = await strategy.validate(payload);
      expect(result.role).toBe(role);
    });
  });
});
