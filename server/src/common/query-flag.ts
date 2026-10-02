import { z } from 'zod';

/** A `true`/`false` query flag. `z.coerce.boolean()` reads the string "false" as true. */
export function queryFlag(defaultValue: boolean) {
  return z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');
}
