import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { CaptchaService } from './captcha.service';

import type { TestingModule } from '@nestjs/testing';
import type { AxiosResponse } from 'axios';

describe('CaptchaService', () => {
  let service: CaptchaService;
  let httpService: HttpService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptchaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    service.clearCache();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CAPTCHA Disabled', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return false;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return '';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });
    });

    it('should allow all requests when CAPTCHA is disabled', async () => {
      const result = await service.verifyCaptcha('any-token');

      expect(result).toEqual({
        isValid: true,
        score: 1.0,
      });
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('CAPTCHA Enabled - No Secret Key', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return true;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return '';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });
    });

    it('should allow requests when secret key is not configured', async () => {
      const result = await service.verifyCaptcha('any-token');

      expect(result).toEqual({
        isValid: true,
        score: 1.0,
      });
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('CAPTCHA Enabled - With Secret Key', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return true;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return 'test-secret-key';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });
    });

    it('should reject empty token', async () => {
      const result = await service.verifyCaptcha('');

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid CAPTCHA token',
      });
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', async () => {
      const result = await service.verifyCaptcha('   ');

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid CAPTCHA token',
      });
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should verify valid CAPTCHA token successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          score: 0.9,
          action: 'login',
          hostname: 'example.com',
          challenge_ts: '2025-11-20T10:00:00Z',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('valid-token', 'login', '192.168.1.1');

      expect(result).toEqual({
        isValid: true,
        score: 0.9,
        hostname: 'example.com',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.any(String),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        },
      );
    });

    it('should reject CAPTCHA with low score', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          score: 0.3, // Below threshold of 0.5
          action: 'login',
          hostname: 'example.com',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('low-score-token', 'login');

      expect(result).toEqual({
        isValid: false,
        score: 0.3,
        hostname: 'example.com',
      });
    });

    it('should reject CAPTCHA with action mismatch', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          score: 0.9,
          action: 'register', // Expected 'login'
          hostname: 'example.com',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('token', 'login');

      expect(result).toEqual({
        isValid: false,
        error: 'CAPTCHA action mismatch',
      });
    });

    it('should handle Google API errors gracefully', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: false,
          'error-codes': ['invalid-input-response'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('invalid-token');

      expect(result).toEqual({
        isValid: false,
        error: 'CAPTCHA token is invalid or expired',
      });
    });

    it('should handle network errors gracefully (fail-open)', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      const result = await service.verifyCaptcha('token');

      expect(result).toEqual({
        isValid: true, // Fail-open for availability
        score: 0.5,
        error: 'CAPTCHA service unavailable',
      });
    });

    it('should use cache for duplicate verifications', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          score: 0.9,
          action: 'login',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      // First call
      const result1 = await service.verifyCaptcha('cached-token');
      expect(httpService.post).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      const result2 = await service.verifyCaptcha('cached-token');
      expect(httpService.post).toHaveBeenCalledTimes(1); // Still 1

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return true;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return 'test-secret';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });

      const status = service.getStatus();

      expect(status).toEqual({
        enabled: true,
        hasSecretKey: true,
        minScore: 0.5,
        cacheSize: expect.any(Number),
      });
    });
  });

  describe('clearCache', () => {
    it('should clear verification cache', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return true;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return 'test-secret';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });

      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          score: 0.9,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      // Add to cache
      await service.verifyCaptcha('token1');
      expect(service.getStatus().cacheSize).toBeGreaterThan(0);

      // Clear cache
      service.clearCache();
      expect(service.getStatus().cacheSize).toBe(0);
    });
  });

  describe('Error Code Handling', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'CAPTCHA_ENABLED') {
          return true;
        }
        if (key === 'RECAPTCHA_SECRET_KEY') {
          return 'test-secret';
        }
        if (key === 'RECAPTCHA_MIN_SCORE') {
          return 0.5;
        }
        return defaultValue;
      });
    });

    it('should handle missing-input-response error', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: false,
          'error-codes': ['missing-input-response'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('token');

      expect(result).toEqual({
        isValid: false,
        error: 'CAPTCHA token is missing',
      });
    });

    it('should handle timeout-or-duplicate error', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('token');

      expect(result).toEqual({
        isValid: false,
        error: 'CAPTCHA token has expired or was already used',
      });
    });

    it('should handle unknown error codes', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: false,
          'error-codes': ['unknown-error'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosResponse['config'],
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.verifyCaptcha('token');

      expect(result).toEqual({
        isValid: false,
        error: 'CAPTCHA verification failed',
      });
    });
  });
});
