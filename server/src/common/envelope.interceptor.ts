import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

import type { ApiEnvelope } from '@sora/contracts';

import { Enveloped, NO_ENVELOPE } from './envelope.ts';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const bypass = this.reflector.getAllAndOverride<boolean>(NO_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((value: unknown) => {
        if (bypass) return value;

        const response = context.switchToHttp().getResponse<{ statusCode: number }>();
        // 204 means "no body"; wrapping would put one back and contradict the status.
        if (response.statusCode === 204 || value === undefined) return value;

        return wrap(value);
      }),
    );
  }
}

function wrap(value: unknown): ApiEnvelope<unknown> {
  const timestamp = new Date().toISOString();

  if (value instanceof Enveloped) {
    return {
      success: true,
      ...(value.message ? { message: value.message } : {}),
      data: value.data,
      meta: {
        timestamp,
        ...(value.pagination ? { pagination: value.pagination } : {}),
      },
    };
  }

  return { success: true, data: value, meta: { timestamp } };
}
