import { UserRole } from '@foodwaste/shared';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { RefreshToken } from '../schemas/refresh-token.schema';

import { TokenService } from './token.service';

import type { TestingModule } from '@nestjs/testing';

// uuid v13 is ESM-only; mock it so Jest can load token.service.ts
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
}));

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60; // 31536000
const FIFTEEN_MIN_SECONDS = 15 * 60; // 900

/**
 * Default env map used across all tests.
 * Override individual keys per-test by re-assigning configMap entries.
 */
const DEFAULT_CONFIG: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '365d',
  JWT_REFRESH_REMEMBER_ME_EXPIRES_IN: '365d',
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
    it('should sign refresh token with JWT_REFRESH_EXPIRES_IN (365d = 31536000s)', async () => {
      await service.generateTokenPair('user-1', 'a@b.com', UserRole.CONSUMER);

      // Promise.all preserves call order: [0] = access, [1] = refresh
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(ONE_YEAR_SECONDS);
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
        before + ONE_YEAR_SECONDS * 1000 - 1000,
      );
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(after + ONE_YEAR_SECONDS * 1000 + 1000);
    });
  });

  // =================================================================
  // generateTokenPair — persistent session (rememberMe = true)
  // =================================================================
  describe('generateTokenPair — rememberMe = true (persistent)', () => {
    it('should sign refresh token with JWT_REFRESH_REMEMBER_ME_EXPIRES_IN (365d = 31536000s)', async () => {
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
      expect(refreshOptions.expiresIn).toBe(ONE_YEAR_SECONDS);
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
        before + ONE_YEAR_SECONDS * 1000 - 1000,
      );
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(after + ONE_YEAR_SECONDS * 1000 + 1000);
    });

    it('should default to 365d when JWT_REFRESH_REMEMBER_ME_EXPIRES_IN env var is missing', async () => {
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
      const THREE_SIXTY_FIVE_DAYS_SECONDS = 365 * 24 * 60 * 60;
      expect(refreshOptions.expiresIn).toBe(THREE_SIXTY_FIVE_DAYS_SECONDS);
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
      const legacyRecord = (({ rememberMe: _rememberMe, ...record }) => record)(buildTokenRecord()); // simulate pre-migration document
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
      const validationUserId = validation.userId;
      if (!validationUserId) {
        throw new Error('Expected refresh token validation to include a userId');
      }

      await service.generateTokenPair(
        validationUserId,
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        validation.jti, // parent JTI
        validation.familyId, // same family
        0,
        validation.rememberMe, // propagated flag
      );

      // Refresh token must be signed with 365d expiry
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(ONE_YEAR_SECONDS);

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

      const validationUserId = validation.userId;
      if (!validationUserId) {
        throw new Error('Expected refresh token validation to include a userId');
      }

      await service.generateTokenPair(
        validationUserId,
        'x@y.com',
        UserRole.CONSUMER,
        undefined,
        validation.jti,
        validation.familyId,
        0,
        validation.rememberMe,
      );

      // Refresh token must be signed with 365d expiry
      const refreshOptions = mockSignAsync.mock.calls[1][1];
      expect(refreshOptions.expiresIn).toBe(ONE_YEAR_SECONDS);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: false }));
    });
  });

  // =================================================================
  // validateRefreshToken — core security flow
  // Tests the exact sequence that runs on every POST /auth/refresh
  // =================================================================
  describe('validateRefreshToken — core security checks', () => {
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

    it('should validate a valid, non-revoked, non-expired token', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord());

      const result = await service.validateRefreshToken('valid.token');

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.jti).toBe('jti-abc');
      expect(result.familyId).toBe('fam-xyz');
    });

    it('should update lastUsedAt on successful validation', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord());

      await service.validateRefreshToken('valid.token');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'record-id' },
        { $set: { lastUsedAt: expect.any(Date) } },
      );
    });

    it('should reject when JWT signature verification fails', async () => {
      mockVerifyAsync.mockRejectedValue(new Error('invalid signature'));

      const result = await service.validateRefreshToken('bad.signature');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid signature');
    });

    it('should reject when JWT is expired at the JWT level', async () => {
      mockVerifyAsync.mockRejectedValue(new Error('jwt expired'));

      const result = await service.validateRefreshToken('expired.jwt');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('jwt expired');
    });

    it('should reject when jti claim is missing from JWT', async () => {
      mockVerifyAsync.mockResolvedValue({ sub: 'user-123' });

      const result = await service.validateRefreshToken('no.jti');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required claims');
    });

    it('should reject when sub claim is missing from JWT', async () => {
      mockVerifyAsync.mockResolvedValue({ jti: 'jti-abc' });

      const result = await service.validateRefreshToken('no.sub');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required claims');
    });

    it('should reject when token not found in database', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.validateRefreshToken('ghost.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token not found');
    });

    it('should reject an expired token (DB expiresAt in the past)', async () => {
      mockFindOne.mockResolvedValue(buildTokenRecord({ expiresAt: new Date(Date.now() - 1000) }));

      const result = await service.validateRefreshToken('db.expired');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('should reject a revoked token (non-rotation revocation)', async () => {
      mockFindOne.mockResolvedValue(
        buildTokenRecord({
          isRevoked: true,
          revokedReason: 'User logged out',
          revokedAt: new Date(),
        }),
      );

      const result = await service.validateRefreshToken('revoked.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    it('should reject when token revocation version is behind user version', async () => {
      mockVerifyAsync.mockResolvedValue({ ...mockPayload, ver: 1 });

      const result = await service.validateRefreshToken(
        'old.ver.token',
        undefined,
        5, // user's current version is 5, token has ver=1
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token revocation version mismatch');
    });

    it('should accept when token version equals user version', async () => {
      mockVerifyAsync.mockResolvedValue({ ...mockPayload, ver: 3 });
      mockFindOne.mockResolvedValue(buildTokenRecord());

      const result = await service.validateRefreshToken('same.ver.token', undefined, 3);

      expect(result.isValid).toBe(true);
    });

    it('should reject token from a compromised family', async () => {
      mockFindOne.mockResolvedValue(
        buildTokenRecord({
          securityMetadata: {
            rotationCount: 5,
            isCompromised: true,
            compromisedReason: 'Token reuse detected',
          },
        }),
      );

      const result = await service.validateRefreshToken('compromised.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token family compromised');
      expect(result.shouldRevokeFamily).toBe(true);
    });

    it('should reject token issued before user lastTokenInvalidation (fixation attack)', async () => {
      const lastInvalidation = new Date();
      mockFindOne.mockResolvedValue(
        buildTokenRecord({
          issuedAt: new Date(Date.now() - 3_600_000), // issued 1 hour ago
        }),
      );

      const result = await service.validateRefreshToken(
        'fixation.token',
        lastInvalidation, // invalidated just now
        0,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token issued before security event');
      expect(result.shouldRevokeFamily).toBe(true);
    });

    it('should accept token issued after lastTokenInvalidation', async () => {
      const lastInvalidation = new Date(Date.now() - 3_600_000); // 1 hour ago
      mockFindOne.mockResolvedValue(
        buildTokenRecord({
          issuedAt: new Date(Date.now() - 60_000), // issued 1 min ago (after invalidation)
        }),
      );

      const result = await service.validateRefreshToken('fresh.token', lastInvalidation, 0);

      expect(result.isValid).toBe(true);
    });
  });

  // =================================================================
  // validateRefreshToken — rotation recovery (crash-mid-rotation)
  // This is the key mechanism that prevents logout when app crashes
  // between receiving new tokens and persisting them
  // =================================================================
  describe('validateRefreshToken — rotation recovery grace period', () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'user@test.com',
      role: UserRole.CONSUMER,
      jti: 'parent-jti',
      familyId: 'fam-xyz',
      ver: 0,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    beforeEach(() => {
      mockVerifyAsync.mockResolvedValue(mockPayload);
    });

    it('should allow re-use of rotated token when child was NEVER used (app crash recovery)', async () => {
      // Parent token: revoked via rotation
      mockFindOne
        .mockResolvedValueOnce({
          _id: 'parent-record',
          jti: 'parent-jti',
          userId: 'user-123',
          familyId: 'fam-xyz',
          isRevoked: true,
          revokedReason: 'Token rotated during refresh',
          revokedAt: new Date(),
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          rememberMe: false,
          securityMetadata: { rotationCount: 1, isCompromised: false },
        })
        // Child token: never used (app crashed before storing it)
        .mockResolvedValueOnce({
          _id: 'child-record',
          jti: 'child-jti',
          parentJti: 'parent-jti',
          familyId: 'fam-xyz',
          isRevoked: false,
          lastUsedAt: null, // never used
        });

      const result = await service.validateRefreshToken('old.parent.token');

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user-123');
      // The orphaned child should be revoked
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'child-record' },
        {
          $set: {
            isRevoked: true,
            revokedAt: expect.any(Date),
            revokedReason: 'Orphaned by rotation recovery',
          },
        },
      );
    });

    it('should detect token theft when child token WAS used (both old + new in play)', async () => {
      // Parent: revoked via rotation
      mockFindOne
        .mockResolvedValueOnce({
          _id: 'parent-record',
          jti: 'parent-jti',
          userId: 'user-123',
          familyId: 'fam-xyz',
          isRevoked: true,
          revokedReason: 'Token rotated during refresh',
          revokedAt: new Date(),
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          rememberMe: false,
          securityMetadata: { rotationCount: 1, isCompromised: false },
        })
        // Child: was already used by attacker or legitimate client
        .mockResolvedValueOnce({
          _id: 'child-record',
          jti: 'child-jti',
          parentJti: 'parent-jti',
          familyId: 'fam-xyz',
          isRevoked: false,
          lastUsedAt: new Date(), // was used!
        });

      const result = await service.validateRefreshToken('stolen.parent.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token reuse detected');
      expect(result.shouldRevokeFamily).toBe(true);
      expect(result.familyId).toBe('fam-xyz');
    });

    it('should reject rotated token when child is already revoked (no recovery)', async () => {
      mockFindOne
        .mockResolvedValueOnce({
          _id: 'parent-record',
          jti: 'parent-jti',
          userId: 'user-123',
          familyId: 'fam-xyz',
          isRevoked: true,
          revokedReason: 'Token rotated during refresh',
          revokedAt: new Date(),
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          rememberMe: false,
          securityMetadata: { rotationCount: 1, isCompromised: false },
        })
        // Child already revoked
        .mockResolvedValueOnce({
          _id: 'child-record',
          jti: 'child-jti',
          parentJti: 'parent-jti',
          familyId: 'fam-xyz',
          isRevoked: true,
          lastUsedAt: null,
        });

      const result = await service.validateRefreshToken('double.revoked.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    it('should reject rotated token when no child exists', async () => {
      mockFindOne
        .mockResolvedValueOnce({
          _id: 'parent-record',
          jti: 'parent-jti',
          userId: 'user-123',
          familyId: 'fam-xyz',
          isRevoked: true,
          revokedReason: 'Token rotated during refresh',
          revokedAt: new Date(),
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          rememberMe: false,
          securityMetadata: { rotationCount: 1, isCompromised: false },
        })
        .mockResolvedValueOnce(null); // no child found

      const result = await service.validateRefreshToken('orphan.parent.token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });
  });

  // =================================================================
  // rotateToken — marks old token as revoked
  // =================================================================
  describe('rotateToken', () => {
    it('should revoke old token and set rotation reason', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'old-record',
        jti: 'old-jti',
        familyId: 'fam-1',
        securityMetadata: { rotationCount: 2 },
      });

      const result = await service.rotateToken('old-jti');

      expect(result).toBe(true);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'old-record' },
        {
          $set: {
            isRevoked: true,
            revokedAt: expect.any(Date),
            revokedReason: 'Token rotated during refresh',
          },
          $inc: {
            'securityMetadata.rotationCount': 1,
          },
        },
      );
    });

    it('should return false when token not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.rotateToken('nonexistent-jti');

      expect(result).toBe(false);
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('should return false and not throw on database error', async () => {
      mockFindOne.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.rotateToken('error-jti');

      expect(result).toBe(false);
    });
  });

  // =================================================================
  // revokeAllUserTokens — logout-all / password change
  // =================================================================
  describe('revokeAllUserTokens', () => {
    it('should revoke all non-revoked tokens for user', async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 5 });

      const count = await service.revokeAllUserTokens('user-1', 'Password changed');

      expect(count).toBe(5);
      expect(mockUpdateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isRevoked: false },
        {
          $set: {
            isRevoked: true,
            revokedAt: expect.any(Date),
            revokedReason: 'Password changed',
          },
        },
      );
    });

    it('should return 0 when no tokens exist', async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 0 });

      const count = await service.revokeAllUserTokens('user-no-tokens', 'Test');

      expect(count).toBe(0);
    });
  });

  // =================================================================
  // revokeFamilyTokens — token theft response
  // =================================================================
  describe('revokeFamilyTokens', () => {
    it('should revoke all non-revoked tokens in a family', async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 3 });

      const count = await service.revokeFamilyTokens('fam-xyz', 'Token reuse detected');

      expect(count).toBe(3);
      expect(mockUpdateMany).toHaveBeenCalledWith(
        { familyId: 'fam-xyz', isRevoked: false },
        {
          $set: {
            isRevoked: true,
            revokedAt: expect.any(Date),
            revokedReason: 'Token reuse detected',
          },
        },
      );
    });
  });

  // =================================================================
  // Full refresh flow simulation
  // Mirrors the exact sequence in auth.service.refreshTokens:
  // validate → rotate old → generate new in same family
  // =================================================================
  describe('full refresh flow (validate → rotate → generate)', () => {
    it('should complete a full refresh cycle with correct token lineage', async () => {
      // 1. Validate: verify JWT and find DB record
      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.com',
        role: UserRole.CONSUMER,
        jti: 'old-jti',
        familyId: 'fam-1',
        ver: 0,
      });
      mockFindOne.mockResolvedValue({
        _id: 'old-record',
        jti: 'old-jti',
        userId: 'user-1',
        familyId: 'fam-1',
        isRevoked: false,
        issuedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
        rememberMe: false,
        securityMetadata: { rotationCount: 3, isCompromised: false },
      });

      const validation = await service.validateRefreshToken('old.token');
      expect(validation.isValid).toBe(true);

      // 2. Rotate: mark old token as revoked
      // Reset findOne for rotateToken's lookup
      mockFindOne.mockResolvedValue({
        _id: 'old-record',
        jti: 'old-jti',
        familyId: 'fam-1',
        securityMetadata: { rotationCount: 3 },
      });
      const rotated = await service.rotateToken(validation.jti as string);
      expect(rotated).toBe(true);

      // 3. Generate: new pair in same family with parent link
      await service.generateTokenPair(
        validation.userId as string,
        'a@b.com',
        UserRole.CONSUMER,
        undefined,
        validation.jti, // parent JTI
        validation.familyId, // same family
        0,
        validation.rememberMe,
      );

      // Verify new token stored with correct lineage
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: 'fam-1', // same family
          parentJti: 'old-jti', // linked to parent
          rememberMe: false,
        }),
      );

      // Verify old token was revoked with rotation reason
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'old-record' },
        expect.objectContaining({
          $set: expect.objectContaining({
            isRevoked: true,
            revokedReason: 'Token rotated during refresh',
          }),
        }),
      );
    });

    it('should handle refresh when access token expired but refresh token valid', async () => {
      // Access token expired (JWT level), but refresh token is fine
      mockVerifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.com',
        role: UserRole.CONSUMER,
        jti: 'valid-refresh-jti',
        familyId: 'fam-2',
        ver: 0,
      });
      mockFindOne.mockResolvedValue({
        _id: 'refresh-record',
        jti: 'valid-refresh-jti',
        userId: 'user-1',
        familyId: 'fam-2',
        isRevoked: false,
        issuedAt: new Date(Date.now() - 86_400_000), // 1 day old
        expiresAt: new Date(Date.now() + 6 * 86_400_000), // 6 days left
        rememberMe: false,
        securityMetadata: { rotationCount: 10, isCompromised: false },
      });

      const validation = await service.validateRefreshToken('refresh.token');

      expect(validation.isValid).toBe(true);
      expect(validation.userId).toBe('user-1');
    });
  });
});
