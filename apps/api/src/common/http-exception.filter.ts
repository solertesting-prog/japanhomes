import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorDto } from '@jpt/shared';
import type { Request, Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

/**
 * One error envelope for every failure. Internal errors never leak stack
 * traces or database messages to the client; they are logged with the request id.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = typeof req.id === 'string' ? req.id : undefined;

    let body: ApiErrorDto;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const obj = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
      body = {
        statusCode: status,
        code: typeof obj.code === 'string' ? obj.code : (CODE_BY_STATUS[status] ?? 'ERROR'),
        message: typeof obj.message === 'string' ? obj.message : exception.message,
        details: obj.details,
        requestId,
      };
    } else {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Quote the request id if you contact support.',
        requestId,
      };
    }
    res.status(body.statusCode).json(body);
  }
}
