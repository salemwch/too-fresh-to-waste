import { CookieSecurityUtil } from './cookie-security.util';

import type { Response } from 'express';

describe('CookieSecurityUtil', () => {
  let mockResponse: Partial<Response>;
  let cookieStore: Record<string, { value: string; options: Record<string, unknown> }>;

  beforeEach(() => {
    cookieStore = {};
    const cookieFn = jest.fn((name: string, value: string, options: Record<string, unknown>) => {
      cookieStore[name] = { value, options };
      return mockResponse as Response;
    }) as unknown as Response['cookie'];

    const clearCookieFn = jest.fn((name: string, _options: Record<string, unknown>) => {
      delete cookieStore[name];
      return mockResponse as Response;
    }) as unknown as Response['clearCookie'];

    mockResponse = {
      cookie: cookieFn,
      clearCookie: clearCookieFn,
    };
  });

  describe('getSecureOptions', () => {
    it('should return secure options with HttpOnly flag in all environments', () => {
      const options = CookieSecurityUtil.getSecureOptions(true, 'example.com');

      expect(options.httpOnly).toBe(true);
    });

    it('should set Secure flag to true in production', () => {
      const options = CookieSecurityUtil.getSecureOptions(true, 'example.com');

      expect(options.secure).toBe(true);
    });

    it('should set Secure flag to false in development', () => {
      const options = CookieSecurityUtil.getSecureOptions(false);

      expect(options.secure).toBe(false);
    });

    it('should set SameSite to strict by default', () => {
      const options = CookieSecurityUtil.getSecureOptions(true, 'example.com');

      expect(options.sameSite).toBe('strict');
    });

    it('should set domain when provided', () => {
      const options = CookieSecurityUtil.getSecureOptions(true, 'example.com');

      expect(options.domain).toBe('example.com');
    });

    it('should set domain to undefined when not provided', () => {
      const options = CookieSecurityUtil.getSecureOptions(true);

      expect(options.domain).toBeUndefined();
    });

    it('should allow custom options to override defaults', () => {
      const options = CookieSecurityUtil.getSecureOptions(true, 'example.com', {
        sameSite: 'lax',
        path: '/custom',
      });

      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/custom');
      expect(options.httpOnly).toBe(true); // Should preserve defaults
    });
  });

  describe('setAccessTokenCookie', () => {
    it('should set access token cookie with HttpOnly flag', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      expect(mockResponse.cookie).toHaveBeenCalled();
      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(true);
    });

    it('should set access token cookie with Secure flag in production', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.secure).toBe(true);
    });

    it('should set access token cookie with SameSite=Strict', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.sameSite).toBe('strict');
    });

    it('should set access token cookie with domain restriction', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.domain).toBe('example.com');
    });

    it('should set access token cookie with path=/', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.path).toBe('/');
    });

    it('should set access token with 15 minutes maxAge', () => {
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'test-access-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.maxAge).toBe(15 * 60 * 1000);
    });

    it('should throw error for invalid token format', () => {
      const invalidToken = 'invalid\r\ntoken';

      expect(() =>
        CookieSecurityUtil.setAccessTokenCookie(
          mockResponse as Response,
          invalidToken,
          true,
          'example.com',
        ),
      ).toThrow('Invalid access token format for cookie');
    });
  });

  describe('setRefreshTokenCookie', () => {
    it('should set refresh token cookie with HttpOnly flag', () => {
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'test-refresh-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(true);
    });

    it('should set refresh token cookie with Secure flag in production', () => {
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'test-refresh-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.secure).toBe(true);
    });

    it('should set refresh token cookie with SameSite=Strict', () => {
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'test-refresh-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.sameSite).toBe('strict');
    });

    it('should set refresh token cookie with path=/api/v1/auth/refresh', () => {
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'test-refresh-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.path).toBe('/api/v1/auth/refresh');
    });

    it('should set refresh token with 7 days maxAge', () => {
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'test-refresh-token',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should throw error for invalid token format', () => {
      const invalidToken = 'invalid\ntoken';

      expect(() =>
        CookieSecurityUtil.setRefreshTokenCookie(
          mockResponse as Response,
          invalidToken,
          true,
          'example.com',
        ),
      ).toThrow('Invalid refresh token format for cookie');
    });
  });

  describe('setSessionCookie', () => {
    it('should set session cookie with HttpOnly flag', () => {
      CookieSecurityUtil.setSessionCookie(
        mockResponse as Response,
        'test-session-id',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(true);
    });

    it('should set session cookie with signed=true', () => {
      CookieSecurityUtil.setSessionCookie(
        mockResponse as Response,
        'test-session-id',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.signed).toBe(true);
    });

    it('should set session cookie with path=/', () => {
      CookieSecurityUtil.setSessionCookie(
        mockResponse as Response,
        'test-session-id',
        true,
        'example.com',
      );

      const cookieOptions = (mockResponse.cookie as jest.Mock).mock.calls[0][2];
      expect(cookieOptions.path).toBe('/');
    });

    it('should throw error for invalid session ID format', () => {
      const invalidSessionId = 'invalid\0session';

      expect(() =>
        CookieSecurityUtil.setSessionCookie(
          mockResponse as Response,
          invalidSessionId,
          true,
          'example.com',
        ),
      ).toThrow('Invalid session ID format for cookie');
    });
  });

  describe('clearAuthCookies', () => {
    it('should clear access_token cookie with correct path', () => {
      CookieSecurityUtil.clearAuthCookies(mockResponse as Response, true, 'example.com');

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('should clear refresh_token cookie with correct path', () => {
      CookieSecurityUtil.clearAuthCookies(mockResponse as Response, true, 'example.com');

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/v1/auth/refresh' }),
      );
    });

    it('should clear cookies with domain restriction', () => {
      CookieSecurityUtil.clearAuthCookies(mockResponse as Response, true, 'example.com');

      const calls = (mockResponse.clearCookie as jest.Mock).mock.calls;
      calls.forEach(call => {
        expect(call[1].domain).toBe('example.com');
      });
    });
  });

  describe('isValidCookieValue', () => {
    it('should return true for valid cookie value', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

      expect(CookieSecurityUtil.isValidCookieValue(validToken)).toBe(true);
    });

    it('should return false for cookie value with carriage return', () => {
      const invalidToken = 'test\rtoken';

      expect(CookieSecurityUtil.isValidCookieValue(invalidToken)).toBe(false);
    });

    it('should return false for cookie value with newline', () => {
      const invalidToken = 'test\ntoken';

      expect(CookieSecurityUtil.isValidCookieValue(invalidToken)).toBe(false);
    });

    it('should return false for cookie value with null byte', () => {
      const invalidToken = 'test\0token';

      expect(CookieSecurityUtil.isValidCookieValue(invalidToken)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(CookieSecurityUtil.isValidCookieValue('')).toBe(false);
    });

    it('should return false for non-string value', () => {
      expect(CookieSecurityUtil.isValidCookieValue(null as unknown as string)).toBe(false);
      expect(CookieSecurityUtil.isValidCookieValue(undefined as unknown as string)).toBe(false);
    });

    it('should return false for cookie value exceeding 4KB', () => {
      const largeToken = 'a'.repeat(4097);

      expect(CookieSecurityUtil.isValidCookieValue(largeToken)).toBe(false);
    });

    it('should return true for cookie value at 4KB limit', () => {
      const largeToken = 'a'.repeat(4096);

      expect(CookieSecurityUtil.isValidCookieValue(largeToken)).toBe(true);
    });
  });

  describe('getSecurityConfig', () => {
    it('should return comprehensive security configuration', () => {
      const config = CookieSecurityUtil.getSecurityConfig(true, 'example.com');

      expect(config).toHaveProperty('securityAttributes');
      expect(config).toHaveProperty('tokenLifetime');
      expect(config).toHaveProperty('pathRestrictions');
      expect(config).toHaveProperty('compliance');
      expect(config).toHaveProperty('auditFindings');
    });

    it('should show all audit findings as RESOLVED', () => {
      const config = CookieSecurityUtil.getSecurityConfig(true, 'example.com');

      expect(config['auditFindings'].httpOnly).toBe('RESOLVED');
      expect(config['auditFindings'].secure).toBe('RESOLVED');
      expect(config['auditFindings'].sameSite).toBe('RESOLVED');
      expect(config['auditFindings'].domain).toBe('RESOLVED');
    });

    it('should include FAANG enterprise-grade compliance level', () => {
      const config = CookieSecurityUtil.getSecurityConfig(true, 'example.com');

      expect(config['compliance'].level).toBe('FAANG Enterprise-Grade');
    });

    it('should show domain as current-domain-only when not specified', () => {
      const config = CookieSecurityUtil.getSecurityConfig(true);

      expect(config['securityAttributes'].domain).toBe('current-domain-only');
    });

    it('should show specified domain in configuration', () => {
      const config = CookieSecurityUtil.getSecurityConfig(true, 'foodwaste.app');

      expect(config['securityAttributes'].domain).toBe('foodwaste.app');
    });
  });

  describe('Integration: Full Cookie Lifecycle', () => {
    it('should set and clear cookies maintaining security attributes', () => {
      // Set cookies
      CookieSecurityUtil.setAccessTokenCookie(
        mockResponse as Response,
        'access-token',
        true,
        'example.com',
      );
      CookieSecurityUtil.setRefreshTokenCookie(
        mockResponse as Response,
        'refresh-token',
        true,
        'example.com',
      );

      // Verify cookies were set
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);

      // Clear cookies
      CookieSecurityUtil.clearAuthCookies(mockResponse as Response, true, 'example.com');

      // Verify cookies were cleared with same domain
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      const clearCalls = (mockResponse.clearCookie as jest.Mock).mock.calls;
      clearCalls.forEach(call => {
        expect(call[1].domain).toBe('example.com');
      });
    });
  });
});
