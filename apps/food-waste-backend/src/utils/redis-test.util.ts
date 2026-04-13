import { createClient } from 'redis';

import { AppLoggerService } from '../common/services/logger.service';
import { buildRedisTlsOptions, getRedisConnectionConfigFromEnv } from '../redis/redis.config';

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

  const redisConfig = getRedisConnectionConfigFromEnv(process.env);
  const tlsOptions = buildRedisTlsOptions(redisConfig);

  const client = createClient({
    ...(redisConfig.username ? { username: redisConfig.username } : {}),
    ...(redisConfig.password ? { password: redisConfig.password } : {}),
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
      connectTimeout: redisConfig.connectTimeout,
      ...(redisConfig.useTls ? { tls: true as const, ...tlsOptions } : {}),
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
    if (client.isOpen) {
      await client.quit();
    }
  }
}
