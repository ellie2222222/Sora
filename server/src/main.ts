import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { API_PREFIX } from '@sora/contracts';

import { AppModule } from './app.module.ts';
import { loadConfig } from './config/env.ts';

async function bootstrap(): Promise<void> {
  // Fails loudly before Nest even starts wiring providers if the environment
  // is unusable — see config/env.ts's own reasoning for validating once, here.
  const config = loadConfig();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // Controllers declare bare ROUTES paths ('/wallets'); the app's client builds
  // the same paths through `apiUrl()`, which prefixes them. Without this the two
  // sides disagree on every single endpoint (API-01).
  app.setGlobalPrefix(API_PREFIX);

  // The mobile app and its web export run from a different origin than the
  // API in every environment (Expo dev server, `expo export --platform web`,
  // a deployed API host) — there is no same-origin deployment to special-case.
  app.enableCors();

  await app.listen(config.PORT);
}

await bootstrap();
