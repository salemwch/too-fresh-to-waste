/**
 * Redis IO Adapter for Socket.IO
 *
 * Enables WebSocket horizontal scaling by syncing events across multiple
 * server instances via Redis pub/sub.
 *
 * Without this adapter, Socket.IO only works on a single instance —
 * users connected to Pod A won't receive events emitted from Pod B.
 *
 * @see https://socket.io/docs/v4/redis-adapter/
 * @see https://github.com/socketio/socket.io-redis-adapter
 */
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RedisClientOptions } from 'redis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = parseInt(this.configService.get<string>('REDIS_PORT', '6379'));
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const username = this.configService.get<string>('REDIS_USERNAME');

    const clientOptions: RedisClientOptions = {
      socket: { host, port },
    };

    if (password) {
      clientOptions.password = password;
    }
    if (username) {
      clientOptions.username = username;
    }

    const pubClient = createClient(clientOptions);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err: Error) =>
      this.logger.error(`Redis pub client error: ${err.message}`),
    );
    subClient.on('error', (err: Error) =>
      this.logger.error(`Redis sub client error: ${err.message}`),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Redis IO adapter connected to ${host}:${port} (pub/sub channels ready)`);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn(
        'Redis adapter not initialized — falling back to in-memory adapter (single-instance only)',
      );
    }

    // Add security headers to Socket.IO HTTP polling responses.
    // Helmet does not cover Socket.IO's internal HTTP handler, so we attach
    // directly to the engine middleware chain.
    interface EngineWithMiddleware {
      use: (
        fn: (
          _req: unknown,
          res: { setHeader: (k: string, v: string) => void },
          next: () => void,
        ) => void,
      ) => void;
    }
    (server.engine as EngineWithMiddleware).use(
      (_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        next();
      },
    );

    return server;
  }
}
