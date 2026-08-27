/**
 * Environment loading and validation.
 *
 * Every value the app needs is validated once, at boot, and the process refuses
 * to start if any is missing or unusable. A secret that reads as "configured"
 * but is empty or too short authenticates nothing while looking fine, so the
 * failure has to happen loudly here rather than degrading at request time.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /**
   * 32 characters is the shortest secret that makes HS256 brute force
   * impractical; a shorter one is a configuration mistake, not a choice.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('finance-api'),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).default(7),

  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  LOGIN_FAILURE_LIMIT: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),

  APP_VERSION: z.string().min(1).default('0.1.0'),

  /** Where the SQL migration runner looks. Defaults to the repo's db/migrations. */
  MIGRATIONS_DIR: z.string().optional(),

  /**
   * The OAuth client id Google issues an ID token for. Verification checks the
   * token's `aud` claim against this, so a token minted for a different app
   * (including the mobile app's own client if it differs by platform) cannot
   * be replayed against this API.
   */
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
});

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

export class ConfigError extends Error {}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  ');
    throw new ConfigError(`Invalid environment configuration:\n  ${detail}`);
  }

  return Object.freeze(parsed.data);
}

export const CONFIG = Symbol('AppConfig');
