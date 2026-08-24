/**
 * Validation runs the Zod schemas exported by @finance/contracts.
 *
 * class-validator is deliberately not used: it would be a second, independently
 * maintained statement of rules the contracts package already owns and the app
 * already validates against, and the two would drift silently.
 */

import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<S> {
    // A ZodError is translated to a 422 with field detail by AllExceptionsFilter,
    // so throwing the library's own error keeps one translation point.
    return this.schema.parse(value) as z.infer<S>;
  }
}

export const zodPipe = <S extends ZodTypeAny>(schema: S) => new ZodValidationPipe(schema);
