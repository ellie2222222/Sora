/**
 * Handlers return either a bare payload or an `Enveloped`, and the interceptor
 * wraps whichever it gets into the ApiEnvelope from @sora/contracts.
 *
 * The wrapper exists so a handler can attach `message` or `pagination` without
 * hand-building the envelope — which is what lets one interceptor guarantee
 * every response has the same shape.
 */

import type { PaginationMeta } from '@sora/contracts';

export class Enveloped<T> {
  constructor(
    readonly data: T,
    readonly message?: string,
    readonly pagination?: PaginationMeta,
  ) {}
}

export function paginated<T>(data: T[], pagination: PaginationMeta): Enveloped<T[]> {
  return new Enveloped(data, undefined, pagination);
}

/** Marks a route whose body must not be wrapped, e.g. the uptime probe. */
export const NO_ENVELOPE = 'finance:noEnvelope';
