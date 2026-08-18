import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import type { AppEnv } from '../config/env.validation';
import { AppErrorCode } from '../common/errors/app-error-codes';
import { AppException } from '../common/exceptions/app.exception';

interface TokenRecord {
  userId: string;
  familyId: string;
  status: 'active' | 'used';
}

const REUSE_DETECTION_WINDOW_SECONDS = 120;

// Opaque refresh tokens, rotated on every use, hashed at rest (docs/ARCHITECTURE.md
// §10 and §20 — "refresh tokens opaque + hashed at rest ... reuse of a revoked
// token revokes the whole family").
@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<AppEnv, true>,
  ) {
    this.ttlSeconds = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 24 * 60 * 60;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenKey(hash: string): string {
    return `refresh:token:${hash}`;
  }

  private familyCurrentKey(familyId: string): string {
    return `refresh:family:${familyId}:current`;
  }

  /** Issues a brand-new token family (login/signup). */
  async issue(userId: string): Promise<string> {
    const familyId = randomBytes(16).toString('hex');
    return this.issueForFamily(userId, familyId);
  }

  private async issueForFamily(userId: string, familyId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const hash = this.hash(token);
    const record: TokenRecord = { userId, familyId, status: 'active' };

    await this.redis
      .multi()
      .set(this.tokenKey(hash), JSON.stringify(record), 'EX', this.ttlSeconds)
      .set(this.familyCurrentKey(familyId), hash, 'EX', this.ttlSeconds)
      .exec();

    return token;
  }

  /**
   * Validates and rotates a refresh token. Throws on expiry, and on reuse of an
   * already-rotated token — in the reuse case the entire family is revoked so a
   * stolen token can't be replayed after the legitimate client has moved on.
   */
  async rotate(token: string): Promise<{ userId: string; token: string }> {
    const hash = this.hash(token);
    const raw = await this.redis.get(this.tokenKey(hash));
    if (!raw) {
      throw AppException.unauthenticated('Session expired. Please log in again.');
    }

    const record = JSON.parse(raw) as TokenRecord;

    if (record.status === 'used') {
      await this.revokeFamily(record.familyId);
      throw new AppException(
        AppErrorCode.TOKEN_REUSE_DETECTED,
        'This session was used from two places at once and has been revoked for safety. Please log in again.',
        401,
      );
    }

    // Mark this token used but keep it briefly so a concurrent duplicate request
    // (not an attacker) still reads 'used' rather than nothing, avoiding a false
    // reuse-triggered family revocation on ordinary network retries.
    await this.redis.set(
      this.tokenKey(hash),
      JSON.stringify({ ...record, status: 'used' } satisfies TokenRecord),
      'EX',
      REUSE_DETECTION_WINDOW_SECONDS,
    );

    const newToken = await this.issueForFamily(record.userId, record.familyId);
    return { userId: record.userId, token: newToken };
  }

  async revoke(token: string): Promise<void> {
    const hash = this.hash(token);
    const raw = await this.redis.get(this.tokenKey(hash));
    if (!raw) return;
    const record = JSON.parse(raw) as TokenRecord;
    await this.revokeFamily(record.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    const currentHash = await this.redis.get(this.familyCurrentKey(familyId));
    const pipeline = this.redis.multi().del(this.familyCurrentKey(familyId));
    if (currentHash) pipeline.del(this.tokenKey(currentHash));
    await pipeline.exec();
  }
}
