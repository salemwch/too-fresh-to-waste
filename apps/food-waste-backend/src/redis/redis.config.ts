import { ConfigService } from '@nestjs/config';

import type { ConnectionOptions, SecureVersion } from 'tls';

export interface RedisConnectionConfig {
  host: string;
  port: number;
  tlsPort?: number;
  username?: string;
  password?: string;
  useTls: boolean;
  rejectUnauthorized: boolean;
  checkServerIdentity: boolean;
  minVersion?: SecureVersion;
  connectTimeout: number;
  commandTimeout: number;
  maxRetries: number;
}

type RedisValueReader = (key: string, defaultValue?: string) => string | undefined;

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 6379;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_COMMAND_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_TLS_MIN_VERSION = 'TLSv1.2';

const ignoreServerIdentityCheck: ConnectionOptions['checkServerIdentity'] = () => undefined;

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }

  return value === 'true';
}

function buildRedisConnectionConfig(read: RedisValueReader): RedisConnectionConfig {
  const redisPort = parseInteger(read('REDIS_PORT', `${DEFAULT_PORT}`), DEFAULT_PORT);
  const redisTlsPort = parseInteger(read('REDIS_TLS_PORT', '0'), 0);
  const useTls = parseBoolean(read('REDIS_TLS', 'false'), false);
  const minVersion =
    read('REDIS_TLS_MIN_VERSION', DEFAULT_TLS_MIN_VERSION) ?? DEFAULT_TLS_MIN_VERSION;

  return {
    host: read('REDIS_HOST', DEFAULT_HOST) ?? DEFAULT_HOST,
    port: useTls && redisTlsPort > 0 ? redisTlsPort : redisPort,
    username: read('REDIS_USERNAME', 'default') ?? 'default',
    password: read('REDIS_PASSWORD', '') ?? '',
    useTls,
    rejectUnauthorized: parseBoolean(read('REDIS_TLS_REJECT_UNAUTHORIZED', 'true'), true),
    checkServerIdentity: parseBoolean(read('REDIS_TLS_CHECK_SERVER_IDENTITY', 'true'), true),
    ...(redisTlsPort > 0 ? { tlsPort: redisTlsPort } : {}),
    ...(minVersion ? { minVersion: minVersion as SecureVersion } : {}),
    connectTimeout: parseInteger(
      read('REDIS_CONNECT_TIMEOUT', `${DEFAULT_CONNECT_TIMEOUT_MS}`),
      DEFAULT_CONNECT_TIMEOUT_MS,
    ),
    commandTimeout: parseInteger(
      read('REDIS_COMMAND_TIMEOUT', `${DEFAULT_COMMAND_TIMEOUT_MS}`),
      DEFAULT_COMMAND_TIMEOUT_MS,
    ),
    maxRetries: parseInteger(
      read('REDIS_MAX_RETRIES', `${DEFAULT_MAX_RETRIES}`),
      DEFAULT_MAX_RETRIES,
    ),
  };
}

export function getRedisConnectionConfig(configService: ConfigService): RedisConnectionConfig {
  return buildRedisConnectionConfig((key, defaultValue) => {
    if (defaultValue === undefined) {
      return configService.get<string>(key) as string | undefined;
    }

    return configService.get<string>(key, defaultValue) as string;
  });
}

export function getRedisConnectionConfigFromEnv(env: NodeJS.ProcessEnv): RedisConnectionConfig {
  return buildRedisConnectionConfig((key, defaultValue) => env[key] ?? defaultValue);
}

export function buildRedisTlsOptions(
  redisConfig: RedisConnectionConfig,
): ConnectionOptions | undefined {
  if (!redisConfig.useTls) {
    return undefined;
  }

  return {
    rejectUnauthorized: redisConfig.rejectUnauthorized,
    ...(redisConfig.checkServerIdentity ? {} : { checkServerIdentity: ignoreServerIdentityCheck }),
    ...(redisConfig.minVersion ? { minVersion: redisConfig.minVersion } : {}),
  };
}

export function buildRedisUrl(redisConfig: RedisConnectionConfig): string {
  const protocol = redisConfig.useTls ? 'rediss' : 'redis';
  const hasCredentials = Boolean(redisConfig.username) || Boolean(redisConfig.password);
  const credentials = hasCredentials
    ? `${encodeURIComponent(redisConfig.username ?? '')}:${encodeURIComponent(
        redisConfig.password ?? '',
      )}@`
    : '';

  return `${protocol}://${credentials}${redisConfig.host}:${redisConfig.port}`;
}

export function buildBullRedisOptions(redisConfig: RedisConnectionConfig) {
  const tls = buildRedisTlsOptions(redisConfig);

  return {
    host: redisConfig.host,
    port: redisConfig.port,
    ...(redisConfig.password ? { password: redisConfig.password } : {}),
    ...(redisConfig.username ? { username: redisConfig.username } : {}),
    ...(tls ? { tls } : {}),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    connectTimeout: redisConfig.connectTimeout,
    commandTimeout: redisConfig.commandTimeout,
  };
}

export function buildThrottlerRedisOptions(redisConfig: RedisConnectionConfig) {
  const tls = buildRedisTlsOptions(redisConfig);

  return {
    connectTimeout: redisConfig.connectTimeout,
    maxRetriesPerRequest: 1,
    ...(tls ? { tls } : {}),
  };
}
