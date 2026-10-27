import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodIssue, ZodType, ZodTypeDef } from 'zod';

import type { TranslationFunction } from './errors.ts';

export interface FieldErrorKey {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * The i18n key for one failed schema rule. The contracts' schemas carry English messages for the API's
 * benefit, so the app ignores them and words the rule itself in the user's language.
 */
export function fieldErrorKey(issue: ZodIssue): FieldErrorKey {
  switch (issue.code) {
    case 'invalid_type':
      return { key: issue.received === 'undefined' || issue.received === 'null' ? 'validation.required' : 'validation.invalid' };
    case 'too_small': {
      const min = Number(issue.minimum);
      if (issue.type === 'string') return min <= 1 ? { key: 'validation.required' } : { key: 'validation.tooShort', params: { min } };
      if (issue.type === 'array' || issue.type === 'set') return min <= 1 ? { key: 'validation.required' } : { key: 'validation.invalid' };
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { key: issue.inclusive ? 'validation.numberTooSmall' : 'validation.numberAbove', params: { min } };
      }
      return { key: 'validation.invalid' };
    }
    case 'too_big': {
      const max = Number(issue.maximum);
      if (issue.type === 'string') return { key: 'validation.tooLong', params: { max } };
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { key: issue.inclusive ? 'validation.numberTooBig' : 'validation.numberBelow', params: { max } };
      }
      return { key: 'validation.invalid' };
    }
    case 'invalid_string':
      return { key: issue.validation === 'email' ? 'validation.invalidEmail' : 'validation.invalid' };
    case 'invalid_enum_value':
    case 'invalid_literal':
    case 'invalid_union_discriminator':
      return { key: 'validation.pickOne' };
    case 'custom': {
      // A refinement can name its own message key, e.g. `ctx.addIssue({ code: 'custom', params: { i18nKey } })`.
      const i18nKey = issue.params?.i18nKey;
      return typeof i18nKey === 'string' ? { key: i18nKey, params: issue.params } : { key: 'validation.invalid' };
    }
    default:
      return { key: 'validation.invalid' };
  }
}

export function fieldErrorMessage(issue: ZodIssue, t: TranslationFunction): string {
  const { key, params } = fieldErrorKey(issue);
  return t(key, params);
}

/** One translated message per field, keyed by dotted path: what a hand-rolled form shows beside each field. */
export function issueMessagesByPath(issues: readonly ZodIssue[], t: TranslationFunction): Record<string, string> {
  const byPath: Record<string, string> = {};
  for (const issue of issues) byPath[issue.path.map(String).join('.')] ??= fieldErrorMessage(issue, t);
  return byPath;
}

/** React Hook Form's nested error shape, first issue per field; a schema-level issue lands on `root`. */
export function fieldErrorsOf(issues: readonly ZodIssue[], t: TranslationFunction): Record<string, unknown> {
  const errors: Record<string, unknown> = {};
  for (const issue of issues) {
    const path = issue.path.length === 0 ? ['root'] : issue.path.map(String);
    let node = errors;
    for (const segment of path.slice(0, -1)) {
      const next = node[segment];
      if (typeof next !== 'object' || next === null || 'message' in next) node[segment] = {};
      node = node[segment] as Record<string, unknown>;
    }
    const leaf = path[path.length - 1]!;
    node[leaf] ??= { type: issue.code, message: fieldErrorMessage(issue, t) };
  }
  return errors;
}

/** `zodResolver` with every message translated (MB-03: the rules still come from `@sora/contracts`). */
export function zodFormResolver<Input extends FieldValues, Output>(
  schema: ZodType<Output, ZodTypeDef, Input>,
  t: TranslationFunction,
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    return { values: {}, errors: fieldErrorsOf(result.error.issues, t) as FieldErrors<Input> };
  };
}
