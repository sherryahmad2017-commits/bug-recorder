import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { ProjectsModule } from './projects/projects.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RedisModule,
    AuthModule,
    OrganisationsModule,
    ProjectsModule,
    HealthModule,
  ],
})
export class AppModule {}
