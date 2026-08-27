import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ROUTES } from '@sora/contracts';

import { NoEnvelope, Public } from '../common/decorators.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';
import { DatabaseService } from '../database/database.service.ts';

/**
 * Envelope-free and unauthenticated by design (§4.1) — an uptime probe should
 * not need a bearer token or JSON-envelope parsing to read one status field.
 * Never logged: probe traffic in the audit trail would drown out real events.
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
  ) {}

  @Public()
  @NoEnvelope()
  @Get(ROUTES.health())
  async check(@Res({ passthrough: true }) res: Response): Promise<Record<string, string>> {
    const up = await this.database.ping();
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: up ? 'ok' : 'degraded',
      version: this.config.APP_VERSION,
      database: up ? 'up' : 'down',
    };
  }
}
