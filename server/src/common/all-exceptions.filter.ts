/**
 * The single place an exception becomes an HTTP status and an ApiErrorBody.
 *
 * Domain failures resolve to an ErrorCode and read their status from
 * ERROR_STATUS, so no handler chooses a number and the mapping stays where
 * @finance/contracts defines it.
 */

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@finance/contracts';

import { AppError } from './app-error.ts';

/**
 * Statuses Nest itself raises for things no service authored — a malformed JSON
 * body, an unmatched route. Mapped explicitly rather than by searching
 * ERROR_STATUS for a matching number, because that search would answer 404 with
 * `WALLET_NOT_FOUND` and tell a client a wallet was missing when the route was.
 */
const FRAMEWORK_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { user?: { id: string } }>();

    const { code, message, status, fields } = classify(exception);

    // §16.1: every 401 and 403 is logged at WARN with actor and target. Tokens
    // and passwords are never part of the logged line.
    const actor = request.user?.id ?? 'anonymous';
    const target = `${request.method} ${request.originalUrl}`;
    if (status === 401 || status === 403) {
      this.logger.warn(`${code} actor=${actor} target=${target}`);
    } else if (status >= 500) {
      this.logger.error(
        `${code} actor=${actor} target=${target}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorBody = {
      success: false,
      message,
      error: { code, ...(fields ? { fields } : {}) },
      meta: { timestamp: new Date().toISOString() },
    };

    response.status(status).json(body);
  }
}

interface Classified {
  code: ErrorCode;
  status: number;
  message: string;
  fields?: Record<string, string[]>;
}

function classify(exception: unknown): Classified {
  if (exception instanceof AppError) {
    return {
      code: exception.code,
      status: exception.status,
      message: exception.message,
      ...(exception.fields ? { fields: exception.fields } : {}),
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
    return {
      code: FRAMEWORK_CODES[status] ?? 'INTERNAL_ERROR',
      status,
      message: exception.message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    status: ERROR_STATUS.INTERNAL_ERROR,
    message: exception instanceof Error ? exception.message : 'Unexpected error',
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
