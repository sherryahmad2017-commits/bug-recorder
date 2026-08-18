import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Distinguishes routes sharing the guard so their counters don't collide. */
  bucket: string;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
