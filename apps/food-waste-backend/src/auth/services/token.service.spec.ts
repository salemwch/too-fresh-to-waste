import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { UserRole } from 'src/common/enums/user.enum';

import { RefreshToken } from '../schemas/refresh-token.schema';

import { TokenService } from './token.service';

import type { TestingModule } from '@nestjs/testing';

// uuid v13 is ESM-only; mock it so Jest can load token.service.ts
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
}));

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604800
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 2592000
const FIFTEEN_MIN_SECONDS = 15 * 60; // 900

/**
 * Default env map used across all tests.
 * Override individual keys per-test by re-assigning configMap entries.
 */
const DEFAULT_CONFIG: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_REFRESH_REMEMBER_ME_EXPIRES_IN: '30d',
};

describe('TokenService', () => {
  let service: TokenService;

  const mockSignAsync = jest.fn();
  const mockVerifyAsync = jest.fn();
  const mockCreate = jest.fn();
  const mockFindOne = jest.fn();
  const mockUpdateOne = jest.fn();
  const mockUpdateMany = jest.fn();

  let configMap: Record<string, string>;

  beforeEach(async () => {
    // Reset uuid counter so each test gets deterministic IDs
    uuidCounter = 0;
    // Reset to defaults before each test
    configMap = { ...DEFAULT_CONFIG };

    mockSignAsync.mockResolvedValue('signed.jwt.token');
    mockVerifyAsync.mockResolvedValue({});
    mockCreate.mockResolvedValue({});
    mockFindOne.mockResolvedValue(null);
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockUpdateMany.mockResolvedValue({ modifiedCount: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            signAsync: mockSignAsync,
            verifyAsync: mockVerifyAsync,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configMap[key]),
          },
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: {
            create: mockCreate,
            findOne: mockFindOne,
            updateOne: mockUpdateOne,
            updateMany: mockUpdateMany,
            countDocuments: jest.fn().mockResolvedValue(0),
            deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =================================================================
  // generateTokenPair — standard session (rememberMe = false)
  // =================================================================
  describe('generateTokenPair — rememberMe = false (default)', () => {
    it('should sign refresh token with JWT_REFRESH_EXPIRES_IN (7d = 604800s)', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      // Promise.all preserves call order: [0] = access, [1] = refresh
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(SEVEN_DAYS_SECONDS);
    });

    it('should sign access token with JWT_EXPIRES_IN (15m = 900s)', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      const accessOptions = mockSignAsync.mock.calls[0][1];
      expect(accessOptions.expiresIn).toBe(FIFTEEN_MIN_SECONDS);
    });

    it('should store rememberMe: false in the DB record', async () => {
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        false,
      );

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: false }));
    });

    it('should store expiresAt ~7 days from now', async () => {
      const before = Date.now();
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);
      const after = Date.now();

      const storedExpiresAt: Date = mockCreate.mock.calls[0][0].expiresAt;

      expect(storedExpiresAt.getTime()).toBeGreaterThanOrEqual(
        before + SEVEN_DAYS_SECONDS * 1000 - 1000,
      );
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(
        after + SEVEN_DAYS_SECONDS * 1000 + 1000,
      );
    });
  });

  // =================================================================
  // generateTokenPair — persistent session (rememberMe = true)
  // =================================================================
  describe('generateTokenPair — rememberMe = true (persistent)', () => {
    it('should sign refresh token with JWT_REFRESH_REMEMBER_ME_EXPIRES_IN (30d = 2592000s)', async () => {
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        true,
      );

      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(THIRTY_DAYS_SECONDS);
    });

    it('should NOT change access token expiry — still 15m regardless of rememberMe', async () => {
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        true,
      );

      const accessOptions = mockSignAsync.mock.calls[0][1];
      expect(accessOptions.expiresIn).toBe(FIFTEEN_MIN_SECONDS);
    });

    it('should store rememberMe: true in the DB record', async () => {
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        true,
      );

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: true }));
    });

    it('should store expiresAt ~30 days from now', async () => {
      const before = Date.now();
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        true,
      );
      const after = Date.now();

      const storedExpiresAt: Date = mockCreate.mock.calls[0][0].expiresAt;

      expect(storedExpiresAt.getTime()).toBeGreaterThanOrEqual(
        before + THIRTY_DAYS_SECONDS * 1000 - 1000,
      );
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(
        after + THIRTY_DAYS_SECONDS * 1000 + 1000,
      );
    });

    it('should default to 30d when JWT_REFRESH_REMEMBER_ME_EXPIRES_IN env var is missing', async () => {
      // Remove the env var to simulate it not being set
      delete configMap['JWT_REFRESH_REMEMBER_ME_EXPIRES_IN'];

      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        undefined,
        undefined,
        0,
        true,
      );

      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(THIRTY_DAYS_SECONDS);
    });
  });

  // =================================================================
  // generateTokenPair — token metadata integrity
  // =================================================================
  describe('generateTokenPair — token metadata integrity', () => {
    it('should generate a unique jti on every call', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);
      await service.generateTokenPair('user-2', 'c@d.com', UserRole.CONSUMER);

      const jti1 = mockCreate.mock.calls[0][0].jti;
      const jti2 = mockCreate.mock.calls[1][0].jti;
      expect(jti1).not.toBe(jti2);
    });

    it('should inherit familyId on rotation', async () => {
      await service.generateTokenPair(
        'user-1',
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        'parent-jti',
        'family-existing',
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: 'family-existing',
          parentJti: 'parent-jti',
        }),
      );
    });

    it('should generate a new familyId for a fresh login (no existingFamilyId)', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      const { familyId, parentJti } = mockCreate.mock.calls[0][0];
      expect(typeof familyId).toBe('string');
      expect(familyId.length).toBeGreaterThan(0);
      expect(parentJti).toBeUndefined();
    });

    it('should store the token hash (not the raw token)', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      const { tokenHash } = mockCreate.mock.calls[0][0];
      expect(typeof tokenHash).toBe('string');
      expect(tokenHash).not.toBe('signed.jwt.token'); // must be hashed, not raw
      expect(tokenHash.length).toBe(64); // SHA-256 hex
    });

    it('should use the provided secret from config for each token type', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      const accessSecret = mockSignAsync.mock.calls[0][1].secret;
      const refreshSecret = mockSignAsync.mock.calls[1][1].secret;

      expect(accessSecret).toBe('test-access-secret');
      expect(refreshSecret).toBe('test-refresh-secret');
    });
  });

  // =================================================================
  // validateRefreshToken — rememberMe flag propagation
  // =================================================================
  describe('validateRefreshToken — rememberMe flag', () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'user@test.com',
      role: UserRole.CONSUMER,
      jti: 'jti-abc',
      familyId: 'fam-xyz',
      ver: 0,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    const buildTokenRecord = (overrides: Record<string, unknown> = {}) => ({
      _id: 'record-id',
      jti: 'jti-abc',
      userId: 'user-123',
      familyId: 'fam-xyz',
      isRevoked: false,
      issuedAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 86_400_000),
      rememberMe: false,
      securityMetadata: { rotationCount: 0, isCompromised: false },
      ...overrides,
    });

    beforeEach(() => {
      mockVerifyAsync.mockResolvedValue(mockPayload);
    });

    it('should return rememberMe: false when token was issued without it', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord({ rememberMe: false }));

      const result = await service.validateRefreshToken('valid.token');

      expect(result.isValid).toBe(true);
      expect(result.rememberMe).toBe(false);
    });

    it('should return rememberMe: true when token was issued with it', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord({ rememberMe: true }));

      const result = await service.validateRefreshToken('valid.token');

      expect(result.isValid).toBe(true);
      expect(result.rememberMe).toBe(true);
    });

    it('should return rememberMe: false for legacy tokens where the field does not exist', async () => {
      const legacyRecord = (({ rememberMe, ...record }) => record)(buildTokenRecord()); // simulate pre-migration document
      mockFindOne.mockResolvedValue(legacyRecord);

      const result = await service.validateRefreshToken('legacy.token');

      expect(result.isValid).toBe(true);
      expect(result.rememberMe).toBe(false);
    });

    it('should NOT include rememberMe when token is not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.validateRefreshToken('ghost.token');

      expect(result.isValid).toBe(false);
      expect(result.rememberMe).toBeUndefined();
    });

    it('should NOT include rememberMe when token is revoked', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord({ isRevoked: true }));

      const result = await service.validateRefreshToken('revoked.token');

      expect(result.isValid).toBe(false);
      expect(result.rememberMe).toBeUndefined();
    });

    it('should NOT include rememberMe when token is expired', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord({ expiresAt: new Date(Date.now() - 1000) }));

      const result = await service.validateRefreshToken('expired.token');

      expect(result.isValid).toBe(false);
      expect(result.rememberMe).toBeUndefined();
    });
  });

  // =================================================================
  // rememberMe survival across rotation
  // Simulates the exact flow: validate old token → generate new one
  // =================================================================
  describe('rememberMe preservation across token rotation', () => {
    it('should carry rememberMe=true from old record into the newly signed token', async () => {
      // --- validate step ---
      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.com',
        role: UserRole.CONSUMER,
        jti: 'old-jti',
        familyId: 'shared-family',
        ver: 0,
      });
      mockFindOne.mockResolvedValue({
        _id: 'old-record',
        jti: 'old-jti',
        userId: 'user-1',
        familyId: 'shared-family',
        isRevoked: false,
        issuedAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() + 25 * 86_400_000), // 25 days left
        rememberMe: true,
        securityMetadata: { rotationCount: 2, isCompromised: false },
      });

      const validation = await service.validateRefreshToken('old.refresh.token');
      expect(validation.isValid).toBe(true);
      expect(validation.rememberMe).toBe(true);

      // --- generate step (mirrors what auth.service.refreshTokens does) ---
      await service.generateTokenPair(
        validation.userId!,
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        validation.jti, // parent JTI
        validation.familyId, // same family
        0,
        validation.rememberMe, // propagated flag
      );

      // Refresh token must be signed with 30d expiry
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(THIRTY_DAYS_SECONDS);

      // Stored record must persist the flag and link to parent
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: 'shared-family',
          parentJti: 'old-jti',
          rememberMe: true,
        }),
      );
    });

    it('should carry rememberMe=false from old record into the newly signed token', async () => {
      mockVerifyAsync.mockResolvedValue({
        sub: 'user-2',
        email: 'x@y.com',
        role: UserRole.CONSUMER,
        jti: 'old-jti-2',
        familyId: 'family-short',
        ver: 0,
      });
      mockFindOne.mockResolvedValue({
        _id: 'old-record-2',
        jti: 'old-jti-2',
        userId: 'user-2',
        familyId: 'family-short',
        isRevoked: false,
        issuedAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now() + 6 * 86_400_000), // 6 days left
        rememberMe: false,
        securityMetadata: { rotationCount: 0, isCompromised: false },
      });

      const validation = await service.validateRefreshToken('short.refresh.token');
      expect(validation.rememberMe).toBe(false);

      await service.generateTokenPair(
        validation.userId!,
        'x@y.com',
        UserRole.CONSUMER,
        undefined,
        validation.jti,
        validation.familyId,
        0,
        validation.rememberMe,
      );

      // Refresh token must be signed with 7d expiry
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(SEVEN_DAYS_SECONDS);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: false }));
    });
  });
});
