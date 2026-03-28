/**
 * Unit Tests for Unified Session Management Service
 * Ensures consolidated service maintains all functionality from both original implementations
 *
 * @module common/security
 * @version 2.0.0
 * @since 2025-11-21
 */

import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { RedisService } from '../../redis/redis.service';
import { User } from '../../users/schemas/user.schema';

import { SessionManagementService } from './session-management.service';

import type { CreateSessionRequest } from '../../common/security/interfaces/session.interface';
import type { TestingModule } from '@nestjs/testing';

describe('SessionManagementService', () => {
  let service: SessionManagementService;
  let userModel: { findById: jest.Mock };

  const mockRedisClient = {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    keys: jest.fn(),
  };

  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    loginHistory: [],
    trustedDevices: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagementService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                SESSION_MAX_CONCURRENT: 5,
                SESSION_TIMEOUT_MS: 15 * 60 * 1000,
                SESSION_REMEMBER_ME_MS: 30 * 24 * 60 * 60 * 1000,
                SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
                SESSION_SUSPICIOUS_THRESHOLD: 3,
              };
              return (config as Record<string, number>)[key];
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockResolvedValue(mockRedisClient),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn().mockResolvedValue(mockUser),
          },
        },
      ],
    }).compile();

    service = module.get<SessionManagementService>(SessionManagementService);
    module.get(RedisService);
    userModel = module.get(getModelToken(User.name));

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('createSession', () => {
    it('should create a new session with valid request', async () => {
      const request: CreateSessionRequest = {
        userId: 'user-123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/96.0',
        ipAddress: '192.168.1.1',
        rememberMe: false,
      };

      mockRedisClient.sMembers.mockResolvedValue([]);

      const session = await service.createSession(request);

      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.isActive).toBe(true);
      expect(session.sessionId).toBeDefined();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      userModel.findById.mockResolvedValueOnce(null);

      const request: CreateSessionRequest = {
        userId: 'invalid-user',
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1',
      };

      await expect(service.createSession(request)).rejects.toThrow('User not found');
    });

    it('should extend session duration with rememberMe', async () => {
      const request: CreateSessionRequest = {
        userId: 'user-123',
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1',
        rememberMe: true,
      };

      mockRedisClient.sMembers.mockResolvedValue([]);

      const session = await service.createSession(request);

      const expectedDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
      const actualDuration = session.expiresAt.getTime() - session.createdAt.getTime();

      expect(actualDuration).toBeGreaterThan(expectedDuration - 1000);
      expect(actualDuration).toBeLessThan(expectedDuration + 1000);
    });

    it('should enforce concurrent session limit', async () => {
      const existingSessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];
      mockRedisClient.sMembers.mockResolvedValue(existingSessions);
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          sessionId: 'session-1',
          userId: 'user-123',
          createdAt: new Date(Date.now() - 10000),
          expiresAt: new Date(Date.now() + 10000),
          isActive: true,
          deviceInfo: {},
          accessToken: '',
          refreshToken: '',
          lastActivityAt: new Date(),
        }),
      );

      const request: CreateSessionRequest = {
        userId: 'user-123',
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1',
      };

      const session = await service.createSession(request);

      expect(session).toBeDefined();
      expect(mockRedisClient.del).toHaveBeenCalled(); // Oldest session removed
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000),
        isActive: true,
        deviceInfo: {},
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.validateSession('session-123');

      expect(result.isValid).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.sessionId).toBe('session-123');
    });

    it('should reject expired session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 10000), // Expired
        isActive: true,
        deviceInfo: {},
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.validateSession('session-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session expired');
      expect(result.wasExpired).toBe(true);
    });

    it('should reject non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.validateSession('non-existent');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should reject inactive session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000),
        isActive: false,
        deviceInfo: {},
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.validateSession('session-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session inactive');
    });
  });

  describe('refreshSession', () => {
    it('should refresh valid session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000),
        isActive: true,
        deviceInfo: {},
        accessToken: 'old-token',
        refreshToken: 'old-refresh',
        createdAt: new Date(),
        lastActivityAt: new Date(Date.now() - 5000),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const refreshed = await service.refreshSession('session-123', 'new-token', 'new-refresh');

      expect(refreshed.accessToken).toBe('new-token');
      expect(refreshed.refreshToken).toBe('new-refresh');
      expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(
        mockSession.lastActivityAt.getTime(),
      );
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should throw for invalid session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.refreshSession('invalid')).rejects.toThrow('Invalid session');
    });
  });

  describe('destroySession', () => {
    it('should destroy existing session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
        isActive: true,
        deviceInfo: {},
        accessToken: '',
        refreshToken: '',
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      await service.destroySession('session-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith('session:session-123');
      expect(mockRedisClient.sRem).toHaveBeenCalled();
    });
  });

  describe('destroyAllUserSessions', () => {
    it('should destroy all sessions for a user', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['session-1', 'session-2', 'session-3']);
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          sessionId: 'session-1',
          userId: 'user-123',
          expiresAt: new Date(),
          isActive: true,
          deviceInfo: {},
          accessToken: '',
          refreshToken: '',
          createdAt: new Date(),
          lastActivityAt: new Date(),
        }),
      );

      await service.destroyAllUserSessions('user-123');

      expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect multiple IPs as suspicious', async () => {
      const sessions = [
        {
          sessionId: 'session-1',
          userId: 'user-123',
          deviceInfo: { ipAddress: '192.168.1.1' },
          isActive: true,
        },
        {
          sessionId: 'session-2',
          userId: 'user-123',
          deviceInfo: { ipAddress: '192.168.1.2' },
          isActive: true,
        },
        {
          sessionId: 'session-3',
          userId: 'user-123',
          deviceInfo: { ipAddress: '192.168.1.3' },
          isActive: true,
        },
      ];

      mockRedisClient.sMembers.mockResolvedValue(['session-1', 'session-2', 'session-3']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(sessions[0]))
        .mockResolvedValueOnce(JSON.stringify(sessions[1]))
        .mockResolvedValueOnce(JSON.stringify(sessions[2]));

      const isSuspicious = await service.detectSuspiciousActivity('user-123');

      expect(isSuspicious).toBe(true);
    });

    it('should not flag normal activity as suspicious', async () => {
      const sessions = [
        {
          sessionId: 'session-1',
          userId: 'user-123',
          deviceInfo: { ipAddress: '192.168.1.1' },
          isActive: true,
        },
        {
          sessionId: 'session-2',
          userId: 'user-123',
          deviceInfo: { ipAddress: '192.168.1.1' },
          isActive: true,
        },
      ];

      mockRedisClient.sMembers.mockResolvedValue(['session-1', 'session-2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(sessions[0]))
        .mockResolvedValueOnce(JSON.stringify(sessions[1]));

      const isSuspicious = await service.detectSuspiciousActivity('user-123');

      expect(isSuspicious).toBe(false);
    });
  });

  describe('getLoginHistory', () => {
    it('should return login history', async () => {
      const mockHistory = [
        { ipAddress: '192.168.1.1', timestamp: new Date(), success: true },
        { ipAddress: '192.168.1.2', timestamp: new Date(), success: true },
      ];

      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          loginHistory: mockHistory,
        }),
      });

      const history = await service.getLoginHistory('user-123', 10);

      expect(history).toHaveLength(2);
    });

    it('should return empty array for user without history', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const history = await service.getLoginHistory('user-123', 10);

      expect(history).toEqual([]);
    });
  });
});
