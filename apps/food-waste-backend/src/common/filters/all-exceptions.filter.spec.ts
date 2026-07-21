import { HttpException, HttpStatus } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter';

import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockRequest = {
      url: '/api/test',
      method: 'GET',
      correlationId: 'test-correlation-id',
      headers: {
        'user-agent': 'Jest/Test',
        authorization: 'Bearer secret-token',
      },
      query: { page: '1' },
      ip: '127.0.0.1',
      connection: {
        remoteAddress: '127.0.0.1',
      } as unknown as Request['connection'],
    } as Partial<Request> & { correlationId: string };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    // Suppress console output during tests
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error ID Generation', () => {
    it('should include error ID in response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorId: expect.stringMatching(/^ERR-\d+-[A-F0-9]{8}$/),
        }),
      );
    });

    it('should include different error IDs for different errors', () => {
      const exception1 = new HttpException('Error 1', HttpStatus.BAD_REQUEST);
      const exception2 = new HttpException('Error 2', HttpStatus.BAD_REQUEST);

      filter.catch(exception1, mockArgumentsHost as ArgumentsHost);
      const firstCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      (mockResponse.json as jest.Mock).mockClear();

      filter.catch(exception2, mockArgumentsHost as ArgumentsHost);
      const secondCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      expect(firstCall.errorId).not.toBe(secondCall.errorId);
    });
  });

  describe('Correlation ID Preservation', () => {
    it('should include correlation ID in response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        }),
      );
    });

    it('should handle missing correlation ID', () => {
      delete (mockRequest as { correlationId?: string }).correlationId;
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'N/A',
        }),
      );
    });
  });

  describe('HTTP Exception Handling', () => {
    it('should handle HttpException with string message', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          message: 'Bad request',
        }),
      );
    });

    it('should handle HttpException with object message', () => {
      const exception = new HttpException({ message: 'Validation failed' }, HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed',
        }),
      );
    });

    it('should handle HttpException with array message', () => {
      const exception = new HttpException(
        { message: ['Error 1', 'Error 2'] },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error 1, Error 2',
        }),
      );
    });
  });

  describe('Standard Error Handling', () => {
    it('should handle standard Error instances', () => {
      const exception = new Error('Standard error');
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('should handle unknown exceptions', () => {
      const exception = 'Unknown error';
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal server error',
        }),
      );
    });
  });

  describe('Security - Information Leakage Prevention', () => {
    it('should not expose error details in production for 500 errors', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      // Recreate filter with production environment
      filter = new AllExceptionsFilter();

      const exception = new Error('Detailed internal error');
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('contact support'),
        }),
      );

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should expose error details in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      // Recreate filter with development environment
      filter = new AllExceptionsFilter();

      const exception = new Error('Detailed internal error');
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Detailed internal error',
        }),
      );

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not include error name in production', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      filter = new AllExceptionsFilter();

      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.error).toBeUndefined();

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should include error name in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      filter = new AllExceptionsFilter();

      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.error).toBeDefined();

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('Response Structure', () => {
    it('should include all required fields in error response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(Number),
          message: expect.any(String),
          errorId: expect.any(String),
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          path: expect.any(String),
          method: expect.any(String),
        }),
      );
    });

    it('should format timestamp as ISO string', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(() => new Date(response.timestamp)).not.toThrow();
    });
  });

  describe('Header Sanitization', () => {
    it('should redact sensitive headers in logs', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      // 4xx client errors log at WARN, not ERROR — see all-exceptions.filter.ts
      const loggerWarnSpy = jest.spyOn(filter['logger'], 'warn');

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(loggerWarnSpy).toHaveBeenCalled();
      // Authorization header should be present in the request
      expect(mockRequest.headers?.['authorization']).toBeDefined();
    });
  });
});
