import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    const [dbOk, redisOk] = await Promise.all([this.checkDb(), this.checkRedis()]);
    if (!dbOk || !redisOk) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        database: dbOk ? 'ok' : 'down',
        redis: redisOk ? 'ok' : 'down',
      });
    }
    return { status: 'ok', database: 'ok', redis: 'ok' };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
