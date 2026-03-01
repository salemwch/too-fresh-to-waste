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
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

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

    const clientOptions: any = {
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

    pubClient.on('error', (err) =>
      this.logger.error(`Redis pub client error: ${err.message}`),
    );
    subClient.on('error', (err) =>
      this.logger.error(`Redis sub client error: ${err.message}`),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(
      `Redis IO adapter connected to ${host}:${port} (pub/sub channels ready)`,
    );
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn(
        'Redis adapter not initialized — falling back to in-memory adapter (single-instance only)',
      );
    }

    return server;
  }
}
