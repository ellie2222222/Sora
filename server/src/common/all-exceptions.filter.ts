/**
 * The single place an exception becomes an HTTP status and an ApiErrorBody.
 *
 * Domain failures resolve to an ErrorCode and read their status from
 * ERROR_STATUS, so no handler chooses a number and the mapping stays where
 * @sora/contracts defines it.
 */

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { inspect } from 'node:util';

import type { Response } from 'express';
import { ZodError } from 'zod';

import { ERROR_STATUS, HTTP_STATUS, type ApiErrorBody, type ErrorCode } from '@sora/contracts';

import { AppError, defaultMessage } from './app-error.ts';
import { pathOf, type RequestWithId } from './request-logging.ts';

/**
 * Statuses Nest itself raises for things no service authored — a malformed JSON
 * body, an unmatched route. Mapped explicitly rather than by searching
 * ERROR_STATUS for a matching number, because that search would answer 404 with
 * `WALLET_NOT_FOUND` and tell a client a wallet was missing when the route was.
 */
const FRAMEWORK_CODES: Record<number, ErrorCode> = {
  [HTTP_STATUS.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HTTP_STATUS.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HTTP_STATUS.FORBIDDEN]: 'FORBIDDEN',
  [HTTP_STATUS.NOT_FOUND]: 'ROUTE_NOT_FOUND',
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
  [HTTP_STATUS.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithId & { user?: { id: string } }>();

    const { code, message, status, fields, params, internal } = classify(exception);

    // §16.1: every 401 and 403 is logged at WARN with actor, role and target.
    // Tokens and passwords are never part of the logged line. `role` is `none`
    // where no membership resolved at all — a 401, or a 404 standing in for one
    // (AC-01) — which is itself the fact worth recording.
    const actor = request.user?.id ?? 'anonymous';
    const target = `${request.method} ${pathOf(request)} rid=${request.requestId ?? 'none'}`;
    if (status === HTTP_STATUS.UNAUTHORIZED || status === HTTP_STATUS.FORBIDDEN) {
      const role = exception instanceof AppError ? (exception.resolvedRole ?? 'none') : 'none';
      this.logger.warn(`${code} actor=${actor} role=${role} target=${target}`);
    } else if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${code} actor=${actor} target=${target}: ${internal ?? message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorBody = {
      success: false,
      message,
      error: { code, ...(fields ? { fields } : {}), ...(params ? { params } : {}) },
      meta: { timestamp: new Date().toISOString() },
    };

    // §2.9: every 429 says when to retry. The per-IP guard sets the header itself; a service-raised limit passes the wait in params.
    const retryAfter = params?.retryAfterSeconds;
    if (status === HTTP_STATUS.TOO_MANY_REQUESTS && typeof retryAfter === 'number' && !response.getHeader('Retry-After')) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfter))));
    }

    response.status(status).json(body);
  }
}

interface Classified {
  code: ErrorCode;
  status: number;
  message: string;
  fields?: Record<string, string[]>;
  params?: Record<string, unknown>;
  /** Logged instead of `message` when the real text is unsafe to return. */
  internal?: string;
}

function classify(exception: unknown): Classified {
  if (exception instanceof AppError) {
    return {
      code: exception.code,
      status: exception.status,
      message: exception.message,
      ...(exception.fields ? { fields: exception.fields } : {}),
      ...(exception.params ? { params: exception.params } : {}),
    };
  }

  if (exception instanceof ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      status: ERROR_STATUS.VALIDATION_FAILED,
      message: exception.issues[0]?.message ?? 'The request could not be validated',
      fields: fieldsOf(exception),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const mapped = FRAMEWORK_CODES[status];
    const code = mapped ?? 'INTERNAL_ERROR';
    // Framework text quotes the caller's body or URL, and a 5xx from a library
    // can carry anything, so only unmapped 4xx (e.g. 413 body too large) pass through.
    const fixed = mapped !== undefined || status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return {
      code,
      status,
      message: fixed ? defaultMessage(code) : exception.message,
      internal: exception.message,
    };
  }

  // An unhandled error's own text is written by whatever threw it — a driver
  // message names the database user, a constraint, or a column. The caller gets
  // a fixed string; the real text reaches the ERROR log above via `internal`.
  return {
    code: 'INTERNAL_ERROR',
    status: ERROR_STATUS.INTERNAL_ERROR,
    message: defaultMessage('INTERNAL_ERROR'),
    internal: exception instanceof Error ? exception.message : inspect(exception, { depth: 2 }),
  };
}

function fieldsOf(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    const existing = fields[key];
    if (existing) existing.push(issue.message);
    else fields[key] = [issue.message];
  }

  return fields;
}
