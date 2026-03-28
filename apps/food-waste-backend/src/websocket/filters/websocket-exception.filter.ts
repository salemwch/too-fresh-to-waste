import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { WebSocketEvents } from '../interfaces/websocket.interface';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    const client: Socket = host.switchToWs().getClient();

    let error = {
      event: WebSocketEvents.ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date(),
    };

    if (exception instanceof WsException) {
      const errorObject = exception.getError();
      const errorDetails =
        typeof errorObject === 'object' && errorObject !== null
          ? (errorObject as { message?: string; code?: string })
          : {};
      error = {
        ...error,
        message:
          typeof errorObject === 'string' ? errorObject : errorDetails.message || error.message,
        code:
          typeof errorObject === 'string' ? 'WS_EXCEPTION' : errorDetails.code || 'WS_EXCEPTION',
      };
    } else if (exception instanceof Error) {
      error = {
        ...error,
        message: exception.message,
        code: 'APPLICATION_ERROR',
      };
    }

    client.emit(WebSocketEvents.ERROR, error);
  }
}
