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
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplication) {
    super(app);
  }

  /**
   * @param pubClient — pass the already-connected RedisService client to reuse
   *   the existing connection instead of opening a new one. Only the subClient
   *   (needed for SUBSCRIBE mode) is created as a duplicate.
   */
  async connectToRedis(pubClient: ReturnType<typeof createClient>): Promise<void> {
    const subClient = pubClient.duplicate();

    subClient.on('error', (err: Error) =>
      this.logger.error(`Redis sub client error: ${err.message}`),
    );

    await subClient.connect();

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis IO adapter ready (reusing shared client, sub channel connected)');
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
