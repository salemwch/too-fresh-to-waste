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

import { EN } from '../../common/errors/catalog/en';
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

  const mockDeviceInfo = {
    deviceId: 'device-001',
    deviceFingerprint: 'fp-abc123',
    deviceName: 'Chrome on Windows',
    platform: 'Windows',
    browser: 'Chrome/96.0',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/96.0',
    isTrusted: false,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    loginHistory: [],
    trustedDevices: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagementService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, number> = {
                SESSION_MAX_CONCURRENT: 5,
                SESSION_TIMEOUT_MS: 15 * 60 * 1000,
                SESSION_REMEMBER_ME_MS: 30 * 24 * 60 * 60 * 1000,
                SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
                SESSION_SUSPICIOUS_THRESHOLD: 3,
              };
              return config[key];
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
      expect(session.deviceInfo.ipAddress).toBe('192.168.1.1');
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

    it('should still return session even when at concurrent limit', async () => {
      const existingSessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];
      mockRedisClient.sMembers.mockResolvedValue(existingSessions);

      const request: CreateSessionRequest = {
        userId: 'user-123',
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1',
      };

      const session = await service.createSession(request);

      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.isActive).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        isActive: true,
        deviceInfo: mockDeviceInfo,
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
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
        expiresAt: new Date(Date.now() - 10000).toISOString(),
        isActive: true,
        deviceInfo: mockDeviceInfo,
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
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
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        isActive: false,
        deviceInfo: mockDeviceInfo,
        accessToken: 'token',
        refreshToken: 'refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.validateSession('session-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Session inactive');
    });
  });

  describe('refreshSession', () => {
    it('should refresh valid session', async () => {
      const lastActivity = new Date(Date.now() - 5000);
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        isActive: true,
        deviceInfo: mockDeviceInfo,
        accessToken: 'old-token',
        refreshToken: 'old-refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: lastActivity.toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const refreshed = await service.refreshSession('session-123', 'new-token', 'new-refresh');

      expect(refreshed.accessToken).toBe('new-token');
      expect(refreshed.refreshToken).toBe('new-refresh');
      expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(lastActivity.getTime());
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should throw for invalid session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.refreshSession('invalid')).rejects.toThrow(EN.SESSION_EXPIRED);
    });
  });

  describe('destroySession', () => {
    it('should destroy existing session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
        isActive: true,
        deviceInfo: mockDeviceInfo,
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
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
          expiresAt: new Date(Date.now() + 10000).toISOString(),
          isActive: true,
          deviceInfo: mockDeviceInfo,
          accessToken: 'mock-access',
          refreshToken: 'mock-refresh',
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        }),
      );

      await service.destroyAllUserSessions('user-123');

      expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('detectSuspiciousActivity', () => {
    function makeSession(id: string, ip: string) {
      return {
        sessionId: id,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        isActive: true,
        deviceInfo: { ...mockDeviceInfo, ipAddress: ip },
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
    }

    it('should detect multiple IPs as suspicious', async () => {
      const sessions = [
        makeSession('session-1', '192.168.1.1'),
        makeSession('session-2', '192.168.1.2'),
        makeSession('session-3', '192.168.1.3'),
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
        makeSession('session-1', '192.168.1.1'),
        makeSession('session-2', '192.168.1.1'),
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
