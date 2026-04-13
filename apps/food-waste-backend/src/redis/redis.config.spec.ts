import {
  buildRedisTlsOptions,
  buildRedisUrl,
  getRedisConnectionConfigFromEnv,
} from './redis.config';

describe('redis.config', () => {
  it('uses the dedicated TLS port when TLS is enabled', () => {
    const redisConfig = getRedisConnectionConfigFromEnv({
      REDIS_HOST: 'redis.example.com',
      REDIS_PORT: '6379',
      REDIS_TLS: 'true',
      REDIS_TLS_PORT: '6380',
      REDIS_USERNAME: 'default',
      REDIS_PASSWORD: 'secret',
    });

    expect(redisConfig.port).toBe(6380);
    expect(buildRedisUrl(redisConfig)).toBe('rediss://default:secret@redis.example.com:6380');
  });

  it('keeps the standard port when TLS is disabled', () => {
    const redisConfig = getRedisConnectionConfigFromEnv({
      REDIS_HOST: 'redis.internal',
      REDIS_PORT: '6379',
      REDIS_TLS: 'false',
    });

    expect(redisConfig.port).toBe(6379);
    expect(buildRedisUrl(redisConfig)).toBe('redis://default:@redis.internal:6379');
    expect(buildRedisTlsOptions(redisConfig)).toBeUndefined();
  });

  it('builds TLS options that can relax certificate checks when explicitly configured', () => {
    const redisConfig = getRedisConnectionConfigFromEnv({
      REDIS_TLS: 'true',
      REDIS_TLS_REJECT_UNAUTHORIZED: 'false',
      REDIS_TLS_CHECK_SERVER_IDENTITY: 'false',
      REDIS_TLS_MIN_VERSION: 'TLSv1.3',
    });

    const tlsOptions = buildRedisTlsOptions(redisConfig);

    expect(tlsOptions?.rejectUnauthorized).toBe(false);
    expect(tlsOptions?.minVersion).toBe('TLSv1.3');
    expect(tlsOptions?.checkServerIdentity).toBeDefined();
    expect(tlsOptions?.checkServerIdentity?.('redis.example.com', {} as never)).toBeUndefined();
  });
});
