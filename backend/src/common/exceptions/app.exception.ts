import { HttpException, HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../errors/app-error-codes';

// Thin wrapper so every deliberately-thrown error carries a stable `code` the
// http-exception filter can surface as `{ error: { code, message, details } }`.
export class AppException extends HttpException {
  constructor(code: AppErrorCode, message: string, status: HttpStatus, details?: unknown) {
    super({ code, message, details }, status);
  }

  static unauthenticated(message = 'Authentication required.'): AppException {
    return new AppException(AppErrorCode.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }

  static invalidCredentials(message = 'Invalid email or password.'): AppException {
    return new AppException(AppErrorCode.INVALID_CREDENTIALS, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'You do not have permission to do this.'): AppException {
    return new AppException(AppErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = 'Resource not found.'): AppException {
    return new AppException(AppErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppException {
    return new AppException(AppErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);
  }
}
