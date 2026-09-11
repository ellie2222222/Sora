/**
 * The one error shape the UI reads.
 *
 * The API owns every message it puts on the wire, so a screen renders
 * `error.message` rather than authoring a second phrasing for a condition the
 * server already reported. The fallbacks here exist only for the cases where
 * there is no server response to render: no network, a timeout, a non-JSON body.
 */

import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@sora/contracts';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: FieldErrors;

  constructor(code: ErrorCode, message: string, status?: number, fields: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
    this.fields = fields;
  }
}

export const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Check your connection and try again.';
export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { error?: unknown; message?: unknown };
  if (typeof candidate.error !== 'object' || candidate.error === null) return false;
  return typeof (candidate.error as { code?: unknown }).code === 'string';
}

/** Turn whatever the transport produced into an ApiError, never throwing itself. */
export function toApiError(status: number | undefined, body: unknown, transportMessage?: string): ApiError {
  if (isErrorBody(body)) {
    return new ApiError(body.error.code, body.message, status, body.error.fields ?? {});
  }
  if (status === undefined) {
    return new ApiError('INTERNAL_ERROR', transportMessage ?? NETWORK_ERROR_MESSAGE, 0);
  }
  return new ApiError('INTERNAL_ERROR', transportMessage ?? UNKNOWN_ERROR_MESSAGE, status);
}

/** The data `ApiError` carries, with no prototype chain — see `serializeApiError`. */
export interface ApiErrorLike {
  readonly code: ErrorCode;
  readonly message: string;
  readonly status: number;
  readonly fields: FieldErrors;
}

/** Structural rather than `instanceof`, so it also matches a serialized (plain-object) `ApiErrorLike`. */
export function isApiError(error: unknown): error is ApiErrorLike {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Partial<ApiErrorLike>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.fields === 'object' &&
    candidate.fields !== null
  );
}

/** Strips the `Error` prototype chain so the result is safe to put in Redux state/actions. */
export function serializeApiError(error: ApiErrorLike): ApiErrorLike {
  return { code: error.code, message: error.message, status: error.status, fields: error.fields };
}

export function messageOf(error: unknown, fallback: string = UNKNOWN_ERROR_MESSAGE): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function fieldErrorsOf(error: unknown): FieldErrors {
  return isApiError(error) ? error.fields : {};
}

/** A 401 the interceptor could not repair — the session is genuinely over. */
export function isUnauthenticated(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'TOKEN_EXPIRED' ||
    error.code === 'TOKEN_INVALID'
  );
}
