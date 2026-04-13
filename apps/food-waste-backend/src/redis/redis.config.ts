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

interface ParsedRedisUrl {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
}

function parseRedisUrl(raw: string | undefined): ParsedRedisUrl | undefined {
  if (!raw?.includes('://')) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    const protocol = url.protocol.replace(':', '').toLowerCase();
    const parsed: ParsedRedisUrl = {
      host: url.hostname,
      useTls: protocol === 'rediss',
    };

    const portNumber = Number.parseInt(url.port, 10);
    if (Number.isFinite(portNumber)) {
      parsed.port = portNumber;
    }

    if (url.username) {
      parsed.username = decodeURIComponent(url.username);
    }
    if (url.password) {
      parsed.password = decodeURIComponent(url.password);
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function buildRedisConnectionConfig(read: RedisValueReader): RedisConnectionConfig {
  // Support REDIS_URL (Upstash/Render convention). Also defensively parse
  // REDIS_HOST in case the full connection URL was pasted there by mistake.
  const urlFromEnv = parseRedisUrl(read('REDIS_URL'));
  const urlFromHost = parseRedisUrl(read('REDIS_HOST'));
  const urlParts = urlFromEnv ?? urlFromHost;

  const redisPort = parseInteger(read('REDIS_PORT', `${DEFAULT_PORT}`), DEFAULT_PORT);
  const redisTlsPort = parseInteger(read('REDIS_TLS_PORT', '0'), 0);
  const explicitTls = read('REDIS_TLS');
  // URL protocol is authoritative: `rediss://` → always TLS, `redis://` → always plain.
  // REDIS_TLS env var only applies when no URL is provided.
  const useTls =
    urlParts?.useTls !== undefined
      ? urlParts.useTls
      : explicitTls !== undefined && explicitTls !== ''
        ? parseBoolean(explicitTls, false)
        : false;

  const minVersion =
    read('REDIS_TLS_MIN_VERSION', DEFAULT_TLS_MIN_VERSION) ?? DEFAULT_TLS_MIN_VERSION;

  const host = urlParts?.host ?? read('REDIS_HOST', DEFAULT_HOST) ?? DEFAULT_HOST;
  const portFromUrl = urlParts?.port;
  const portFromEnv = useTls && redisTlsPort > 0 ? redisTlsPort : redisPort;
  const port = portFromUrl ?? portFromEnv;

  const username = urlParts?.username ?? read('REDIS_USERNAME', 'default') ?? 'default';
  const password = urlParts?.password ?? read('REDIS_PASSWORD', '') ?? '';

  return {
    host,
    port,
    username,
    password,
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
