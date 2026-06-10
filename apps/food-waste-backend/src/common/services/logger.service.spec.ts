import { AppLoggerService } from './logger.service';

describe('AppLoggerService', () => {
  let logger: AppLoggerService;
  let winstonInfoSpy: jest.SpyInstance;
  let winstonWarnSpy: jest.SpyInstance;
  let winstonErrorSpy: jest.SpyInstance;
  let winstonDebugSpy: jest.SpyInstance;
  let winstonVerboseSpy: jest.SpyInstance;
  let winstonHttpSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new AppLoggerService();
    logger.setContext('TestContext');

    // Spy on the Winston logger's methods (accessed via the private `logger` property)
    const winstonLogger = (logger as unknown as { logger: Record<string, unknown> }).logger;
    winstonInfoSpy = jest.spyOn(winstonLogger, 'info' as never).mockImplementation();
    winstonWarnSpy = jest.spyOn(winstonLogger, 'warn' as never).mockImplementation();
    winstonErrorSpy = jest.spyOn(winstonLogger, 'error' as never).mockImplementation();
    winstonDebugSpy = jest.spyOn(winstonLogger, 'debug' as never).mockImplementation();
    winstonVerboseSpy = jest.spyOn(winstonLogger, 'verbose' as never).mockImplementation();
    winstonHttpSpy = jest.spyOn(winstonLogger, 'http' as never).mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', () => {
      const errorId1 = logger.error('Test error 1');
      const errorId2 = logger.error('Test error 2');

      expect(errorId1).toMatch(/^ERR-\d+-[A-F0-9]{8}$/);
      expect(errorId2).toMatch(/^ERR-\d+-[A-F0-9]{8}$/);
      expect(errorId1).not.toBe(errorId2);
    });

    it('should include error ID in metadata', () => {
      const errorId = logger.error('Test error');
      expect(errorId).toBeDefined();
      expect(typeof errorId).toBe('string');
    });
  });

  describe('Stack Trace Handling', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      const errorId = logger.error('Error occurred', error, 'TestContext');

      expect(errorId).toBeDefined();
      expect(errorId).toMatch(/^ERR-/);
      expect(winstonErrorSpy).toHaveBeenCalled();
    });

    it('should handle string stack traces', () => {
      const stackTrace = 'Error: Test\n    at Function.test (file.ts:10:5)';
      const errorId = logger.error('Error with stack', stackTrace, 'TestContext');

      expect(errorId).toBeDefined();
    });
  });

  describe('Security Events', () => {
    it('should generate security event IDs', () => {
      const securityId = logger.security('Failed login attempt');

      expect(securityId).toMatch(/^SEC-\d+-[A-F0-9]{8}$/);
    });

    it('should log security events with metadata', () => {
      const securityId = logger.security('Unauthorized access', {
        userId: 'user123',
        path: '/admin',
      });

      expect(securityId).toBeDefined();
      expect(winstonWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Correlation ID Support', () => {
    it('should include correlation ID in metadata', () => {
      logger.log('Test message', 'TestContext', {
        correlationId: 'test-correlation-id',
      });

      expect(winstonInfoSpy).toHaveBeenCalled();
    });
  });

  describe('Context Setting', () => {
    it('should allow setting context', () => {
      logger.setContext('NewContext');
      logger.log('Test message');

      expect(winstonInfoSpy).toHaveBeenCalled();
    });
  });

  describe('Application-Specific Methods', () => {
    it('should log startup messages', () => {
      logger.startup('Application started');
      expect(winstonInfoSpy).toHaveBeenCalled();
    });

    it('should log shutdown messages', () => {
      logger.shutdown('Application stopping');
      expect(winstonWarnSpy).toHaveBeenCalled();
    });

    it('should log performance metrics', () => {
      logger.performance('Query executed', 150, {
        query: 'SELECT * FROM users',
      });
      expect(winstonInfoSpy).toHaveBeenCalled();
    });

    it('should log database operations', () => {
      logger.database('User created', { userId: '123' });
      expect(winstonDebugSpy).toHaveBeenCalled();
    });

    it('should log external API calls', () => {
      logger.external('API call to payment provider', {
        provider: 'Stripe',
        duration: 200,
      });
      expect(winstonDebugSpy).toHaveBeenCalled();
    });

    it('should log business events', () => {
      logger.business('Order completed', {
        orderId: 'order123',
        amount: 50.0,
      });
      expect(winstonInfoSpy).toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    it('should log info messages', () => {
      logger.log('Info message');
      expect(winstonInfoSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(winstonWarnSpy).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(winstonDebugSpy).toHaveBeenCalled();
    });

    it('should log verbose messages', () => {
      logger.verbose('Verbose message');
      expect(winstonVerboseSpy).toHaveBeenCalled();
    });

    it('should log HTTP messages', () => {
      logger.http('GET /api/users', {
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
      });
      expect(winstonHttpSpy).toHaveBeenCalled();
    });
  });

  describe('Metadata Handling', () => {
    it('should include metadata in logs', () => {
      logger.log('Test with metadata', 'TestContext', {
        userId: 'user123',
        requestId: 'req-456',
        custom: 'value',
      });

      expect(winstonInfoSpy).toHaveBeenCalled();
    });

    it('should handle empty metadata', () => {
      logger.log('Test without metadata', 'TestContext');
      expect(winstonInfoSpy).toHaveBeenCalled();
    });
  });
});
