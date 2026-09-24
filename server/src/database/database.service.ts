import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { CONFIG, type AppConfig } from '../config/env.ts';
import { verifyPgTypeParsers } from './pg-types.ts';
import type { DB } from './types.ts';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  readonly db: Kysely<DB>;
  private readonly pool: pg.Pool;

  constructor(@Inject(CONFIG) config: AppConfig) {
    verifyPgTypeParsers();

    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_MAX,
      statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS,
      connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    });

    this.db = new Kysely<DB>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });
  }

  /** Liveness probe for GET /health. */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Database ping failed: ${(error as Error).message}`);
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
