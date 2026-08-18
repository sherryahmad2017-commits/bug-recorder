import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AppErrorCode } from '../errors/app-error-codes';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const body = this.normalize(response, status);
      reply.status(status).send({ error: body });
      return;
    }

    // Never leak internal error details (stack traces, DB errors) to clients.
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: { code: AppErrorCode.INTERNAL, message: 'Something went wrong. Please try again.' } satisfies ErrorBody,
    });
  }

  private normalize(response: string | object, status: number): ErrorBody {
    if (typeof response === 'object' && response !== null && 'code' in response && 'message' in response) {
      const r = response as { code: unknown; message: unknown; details?: unknown };
      return { code: String(r.code), message: String(r.message), details: r.details };
    }

    // class-validator ValidationPipe throws { message: string[], error: 'Bad Request', statusCode }
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const r = response as { message: unknown };
      const message = Array.isArray(r.message) ? r.message.join(' ') : String(r.message);
      return { code: AppErrorCode.VALIDATION_FAILED, message, details: Array.isArray(r.message) ? r.message : undefined };
    }

    return { code: `http_${status}`, message: typeof response === 'string' ? response : 'Request failed.' };
  }
}
