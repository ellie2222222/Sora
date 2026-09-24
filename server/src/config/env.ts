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
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  /** Server-side cap per statement, so one runaway query cannot hold a pooled connection forever. */
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1).default(15_000),
  /** How long a request waits for a free pooled connection before failing instead of queueing unbounded. */
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1).default(5_000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1).default(30_000),

  /**
   * Browser origins allowed to call the API, comma-separated (the Expo web export). Native apps send
   * no Origin and are unaffected. Unset: any origin outside production, none in production.
   */
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  /**
   * 32 characters is the shortest secret that makes HS256 brute force
   * impractical; a shorter one is a configuration mistake, not a choice.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('sora-server'),

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
   * OAuth client id(s) Google issues an ID token for, comma-separated — a
   * mobile app's `aud` varies per platform client id, so every one the app
   * can sign in with must be listed or that platform's tokens fail verification.
   */
  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, 'GOOGLE_CLIENT_ID is required')
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .refine((ids) => ids.length > 0, 'GOOGLE_CLIENT_ID is required'),

  EXCHANGE_RATE_API_URL: z.string().url().default('https://open.er-api.com/v6/latest'),
  EXCHANGE_RATE_TIMEOUT_SECONDS: z.coerce.number().int().min(1).default(5),
  EXCHANGE_RATE_CACHE_TTL_MINUTES: z.coerce.number().int().min(1).default(720),
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
