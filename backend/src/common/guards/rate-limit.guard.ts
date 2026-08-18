import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AppErrorCode } from '../errors/app-error-codes';
import { AppException } from '../exceptions/app.exception';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/rate-limit.decorator';

// Redis-backed fixed-window limiter, per docs/ARCHITECTURE.md §20. Keyed by
// client IP + an optional account identifier (email in the request body) so
// both "per IP" and "per account" limits from the architecture doc apply.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const accountKey = typeof request.body?.email === 'string' ? `:${request.body.email.toLowerCase()}` : '';
    const key = `ratelimit:${options.bucket}:${ip}${accountKey}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, options.windowSeconds);
    }

    if (count > options.limit) {
      throw new AppException(
        AppErrorCode.RATE_LIMITED,
        'Too many requests. Please wait a moment and try again.',
        429,
      );
    }

    return true;
  }
}
