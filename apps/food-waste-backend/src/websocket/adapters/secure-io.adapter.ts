import { IoAdapter } from '@nestjs/platform-socket.io';

import type { ServerOptions, Server } from 'socket.io';

/**
 * SecureIoAdapter — used in development (non-Redis) mode.
 * Adds security headers to Socket.IO HTTP polling responses that
 * Helmet cannot reach because Socket.IO manages its own HTTP handler.
 */
export class SecureIoAdapter extends IoAdapter {
  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    server.engine.use(
      (_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        next();
      },
    );

    return server;
  }
}
