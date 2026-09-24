import { randomUUID } from 'node:crypto';

import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { API_PREFIX, ROUTES } from '@sora/contracts';

export type RequestWithId = Request & { requestId?: string };

/** An incoming id is only reused when it looks like one, so a client cannot inject text into log lines. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
// LA-04: probe traffic would bury the audit trail.
const HEALTH_PATH = `${API_PREFIX}${ROUTES.health()}`;

/** Path without its query string — query values never reach the logs (LA-01). */
export function pathOf(request: Request): string {
  return request.originalUrl.split('?')[0] ?? request.originalUrl;
}

/**
 * One access-log line per request (method, path, status, duration, request id), and an
 * `x-request-id` response header so a client-side error can be matched to its server line.
 */
export function requestLogging(logger: LoggerService) {
  return (request: RequestWithId, response: Response, next: NextFunction): void => {
    const incoming = request.header('x-request-id');
    const requestId = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const path = pathOf(request);
    if (path === HEALTH_PATH) {
      next();
      return;
    }

    const started = process.hrtime.bigint();
    response.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      logger.log(`${request.method} ${path} ${response.statusCode} ${ms.toFixed(1)}ms rid=${requestId}`, 'Access');
    });
    next();
  };
}

/** Headers worth sending from a JSON-only API; the rest of helmet's set targets HTML pages. */
export function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
