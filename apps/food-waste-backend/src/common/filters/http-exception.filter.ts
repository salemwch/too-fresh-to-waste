// src/common/filters/global-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        // Enhanced logging for validation errors
        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            this.logger.error(
                `HTTP Exception [${status}] ${request.method} ${request.url}`,
                JSON.stringify({
                    message: exceptionResponse,
                    body: request.body,
                    query: request.query,
                    params: request.params,
                }, null, 2)
            );
        } else {
            this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : JSON.stringify(exception));
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }
}
