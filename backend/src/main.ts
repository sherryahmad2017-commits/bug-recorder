import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { AppEnv } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true }));
  const config = app.get(ConfigService<AppEnv, true>);

  await app.register(helmet, {
    // The dashboard is a separate Next.js app with its own CSP; this API
    // never serves HTML, so a strict default-src 'none' is safe here.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
  });

  const dashboardOrigin = config.get('DASHBOARD_ORIGIN', { infer: true });
  const extensionIds = config
    .get('EXTENSION_IDS', { infer: true })
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const allowedOrigins = [dashboardOrigin, ...extensionIds.map((id) => `chrome-extension://${id}`)];

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin/non-browser requests (no Origin header) and the extension's
      // background-worker fetches are allowed; browser-context calls are
      // checked against the explicit allow-list per docs/ARCHITECTURE.md §20.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy.'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`ReproFlow API listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  Logger.error('Failed to start ReproFlow API', error);
  process.exit(1);
});
