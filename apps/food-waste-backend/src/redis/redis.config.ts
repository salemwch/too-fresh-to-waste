import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

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

/** The three connection roles Bull asks its `createClient` factory for. */
export type BullClientType = 'client' | 'subscriber' | 'bclient';

/**
 * One connection factory for every Bull queue, so they share instead of each
 * opening its own set.
 *
 * Bull opens three connections *per queue* by default. There are six queues —
 * donations, pickup-reminders, review-processing, search-indexing, plus the
 * two registered under constants (DELIVERY_TIMEOUT_QUEUE, NOTIFICATION_QUEUE),
 * which is easy to undercount when grepping for string literals. That is
 * eighteen, plus two for the Socket.IO adapter, one for RedisService and one
 * for the throttler: twenty-two from a single process, against a Redis Cloud
 * free plan that allows thirty.
 *
 * One process therefore left eight connections spare, and a deploy briefly
 * runs two — forty-four. Production could not finish booting:
 *
 *   ERROR [RedisService] Redis error: ERR max number of clients reached
 *   ERROR Failed to start the application: Max reconnection attempts reached
 *
 * That failure exits the process, PM2 restarts it, and the replacement asks for
 * sixteen more while the killed process's sockets are still held open — it was
 * killed mid-bootstrap, so they lapse on TCP timeout rather than closing. Each
 * restart made the shortage worse, so the loop could not exit on its own.
 *
 * Sharing takes the Bull total from 3n to n + 2 — eighteen connections down to
 * eight at six queues, so the process holds twelve rather than twenty-two.
 * Measured at twelve on the Redis Cloud connections graph after deploying.
 *
 * Two roles cannot be shared or reconfigured casually:
 *
 * - `bclient` must be its own connection per queue. It issues blocking reads
 *   (BRPOPLPUSH), which occupy a connection for their whole duration; sharing
 *   one would serialise every queue behind whichever blocked first.
 *
 * - `bclient` and `subscriber` must not carry `commandTimeout`. A blocking read
 *   is *meant* to sit idle waiting for work, so a command timeout aborts it and
 *   the queue silently stops consuming — it looks like jobs are never picked up
 *   rather than like a misconfiguration. `maxRetriesPerRequest` is likewise
 *   null on these, which is what ioredis requires for blocking and pub/sub use.
 *
 * @see https://github.com/OptimalBits/bull/blob/develop/PATTERNS.md#reusing-redis-connections
 */
export function createBullClientFactory(redisConfig: RedisConnectionConfig) {
  const base = buildBullRedisOptions(redisConfig);

  // `commandTimeout` is deliberately dropped for the blocking/pub-sub roles.
  const { commandTimeout: _commandTimeout, ...blockingSafe } = base;
  const blockingOptions = {
    ...blockingSafe,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  // Created on first request rather than up front, so a process that registers
  // no queues opens no Bull connections at all.
  let sharedClient: IORedis | undefined;
  let sharedSubscriber: IORedis | undefined;

  return (type: BullClientType): IORedis => {
    switch (type) {
      case 'client':
        sharedClient ??= new IORedis(base);
        return sharedClient;

      case 'subscriber':
        sharedSubscriber ??= new IORedis(blockingOptions);
        return sharedSubscriber;

      case 'bclient':
        return new IORedis(blockingOptions);

      default: {
        // Bull only ever asks for the three above; a fourth would mean the
        // library changed under us, and guessing a connection shape here would
        // be worse than failing loudly.
        const unreachable: never = type;
        throw new Error(`Unsupported Bull client type: ${String(unreachable)}`);
      }
    }
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
