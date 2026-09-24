import 'reflect-metadata';

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { API_PREFIX } from '@sora/contracts';

import { AppModule } from './app.module.ts';
import { requestLogging, securityHeaders } from './common/request-logging.ts';
import { loadConfig } from './config/env.ts';

async function bootstrap(): Promise<void> {
  // Fails loudly before Nest even starts wiring providers if the environment
  // is unusable — see config/env.ts's own reasoning for validating once, here.
  const config = loadConfig();

  // JSON lines in production so a log pipeline can filter by field; readable text locally.
  const logger = new ConsoleLogger({
    logLevels: ['log', 'warn', 'error'],
    json: config.NODE_ENV === 'production',
  });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });

  // Controllers declare bare ROUTES paths ('/wallets'); the app's client builds
  // the same paths through `apiUrl()`, which prefixes them. Without this the two
  // sides disagree on every single endpoint (API-01).
  app.setGlobalPrefix(API_PREFIX);

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(requestLogging(logger));

  // Only browsers enforce CORS, so this governs the Expo web export; native apps send no Origin.
  app.enableCors({
    origin:
      config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : config.NODE_ENV !== 'production',
    exposedHeaders: ['x-request-id'],
  });

  // Runs DatabaseService.onApplicationShutdown on SIGTERM/SIGINT, so `docker stop` drains the pool.
  app.enableShutdownHooks();

  await app.listen(config.PORT);
}

await bootstrap();
