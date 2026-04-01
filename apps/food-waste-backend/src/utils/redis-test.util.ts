import { createClient } from 'redis';

import { AppLoggerService } from '../common/services/logger.service';

/**
 * Test Redis connectivity using environment variables.
 *
 * Required env vars: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USERNAME
 * Optional: REDIS_TLS (set to 'true' for TLS connections)
 *
 * Usage: Set env vars and call testRedisConnection()
 */
export async function testRedisConnection(): Promise<boolean> {
  const logger = new AppLoggerService();
  logger.log('Testing Redis connection...', 'RedisTest');

  const host = process.env['REDIS_HOST'];
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
  const password = process.env['REDIS_PASSWORD'];
  const username = process.env['REDIS_USERNAME'] ?? 'default';
  const useTls = process.env['REDIS_TLS'] === 'true';

  if (!host) {
    logger.error('REDIS_HOST environment variable is not set', undefined, 'RedisTest');
    return false;
  }

  const client = createClient({
    username,
    ...(password ? { password } : {}),
    socket: {
      host,
      port,
      ...(useTls ? { tls: true as const } : {}),
      connectTimeout: 10000,
    },
  });

  try {
    await client.connect();

    // Test basic operations
    await client.set('test:connectivity', 'ok');
    const result = await client.get('test:connectivity');

    if (result === 'ok') {
      logger.log('Redis connection successful!', 'RedisTest');
      await client.del('test:connectivity');
      return true;
    }
    logger.log('Redis test failed - unexpected result', 'RedisTest');
    return false;
  } catch (error) {
    logger.error(
      'Redis connection failed',
      error instanceof Error ? error.stack : String(error),
      'RedisTest',
    );
    return false;
  } finally {
    await client.quit();
  }
}
