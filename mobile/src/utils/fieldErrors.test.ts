import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readFileSync } from 'node:fs';

import { createBudgetSchema, createWalletSchema, loginSchema, passwordSchema, positiveAmountSchema, registerSchema } from '@sora/contracts';
import { z } from 'zod';

import en from '../app/i18n/locales/en.ts';
import { fieldErrorKey, fieldErrorsOf, issueMessagesByPath, zodFormResolver } from './fieldErrors.ts';

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`);

function firstIssues(schema: z.ZodTypeAny, value: unknown): z.ZodIssue[] {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  return result.error!.issues;
}

function firstIssue(schema: z.ZodTypeAny, value: unknown): z.ZodIssue {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  return result.error!.issues[0]!;
}

describe('fieldErrorKey', () => {
  it('reads an empty required string as required, despite the schema message', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(loginSchema.shape.password, '')), { key: 'validation.required' });
    assert.deepEqual(fieldErrorKey(firstIssue(createWalletSchema.shape.name, '   ')), { key: 'validation.required' });
  });

  it('names the minimum and maximum length of a string', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(passwordSchema, 'short')), { key: 'validation.tooShort', params: { min: 12 } });
    assert.deepEqual(fieldErrorKey(firstIssue(passwordSchema, 'x'.repeat(201))), { key: 'validation.tooLong', params: { max: 200 } });
  });

  it('reads a malformed email as an email error', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(loginSchema.shape.email, 'not-an-email')), { key: 'validation.invalidEmail' });
  });

  it('reads a missing value as required and a wrong type as invalid', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(z.string(), undefined)), { key: 'validation.required' });
    assert.deepEqual(fieldErrorKey(firstIssue(z.string(), 42)), { key: 'validation.invalid' });
  });

  it('keeps inclusive and exclusive number bounds apart', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(z.number().min(1), 0)), { key: 'validation.numberTooSmall', params: { min: 1 } });
    assert.deepEqual(fieldErrorKey(firstIssue(z.number().gt(0), 0)), { key: 'validation.numberAbove', params: { min: 0 } });
    assert.deepEqual(fieldErrorKey(firstIssue(z.number().max(9), 10)), { key: 'validation.numberTooBig', params: { max: 9 } });
    assert.deepEqual(fieldErrorKey(firstIssue(z.number().lt(9), 9)), { key: 'validation.numberBelow', params: { max: 9 } });
  });

  it('asks for one of the options on an enum miss', () => {
    assert.deepEqual(fieldErrorKey(firstIssue(z.enum(['A', 'B']), 'C')), { key: 'validation.pickOne' });
  });

  it('uses a refinement’s own key when it names one, and the generic key otherwise', () => {
    const named = z.string().superRefine((_, ctx) => ctx.addIssue({ code: 'custom', params: { i18nKey: 'budgets.endBeforeStart' } }));
    assert.equal(fieldErrorKey(firstIssue(named, 'x')).key, 'budgets.endBeforeStart');
    const unnamed = z.string().refine(() => false, 'English only');
    assert.deepEqual(fieldErrorKey(firstIssue(unnamed, 'x')), { key: 'validation.invalid' });
  });
});

describe('fieldErrorsOf', () => {
  it('keeps the first issue per field and nests dotted paths', () => {
    const errors = fieldErrorsOf(
      [
        { code: 'custom', path: ['a', 'b'], message: 'first' },
        { code: 'custom', path: ['a', 'b'], message: 'second' },
        { code: 'custom', path: [], message: 'form' },
      ],
      t,
    );
    assert.deepEqual(errors, {
      a: { b: { type: 'custom', message: 'validation.invalid' } },
      root: { type: 'custom', message: 'validation.invalid' },
    });
  });
});

describe('zodFormResolver', () => {
  const options = { fields: {}, shouldUseNativeValidation: false };

  it('returns the parsed values when the form is valid', async () => {
    const result = await zodFormResolver(loginSchema, t)({ email: ' A@Example.com ', password: 'x' }, undefined, options);
    assert.deepEqual(result, { values: { email: 'a@example.com', password: 'x' }, errors: {} });
  });

  it('returns translated errors per field when it is not', async () => {
    const schema = registerSchema.omit({ timeZone: true });
    const result = await zodFormResolver(schema, t)({ email: 'nope', password: 'short', displayName: '' }, undefined, options);
    assert.deepEqual(result.values, {});
    assert.deepEqual(result.errors, {
      email: { type: 'invalid_string', message: 'validation.invalidEmail' },
      password: { type: 'too_small', message: 'validation.tooShort:{"min":12}' },
      displayName: { type: 'too_small', message: 'validation.required' },
    });
  });
});

describe('issueMessagesByPath', () => {
  it('keys a translated message by dotted path, keeping the first per field', () => {
    const issues = [
      ...firstIssues(createWalletSchema, { name: '', timeZone: 'Asia/Ho_Chi_Minh', baseCurrency: 'VND' }),
      { code: 'custom', path: ['name'], message: 'second' } as z.ZodIssue,
    ];
    assert.equal(issueMessagesByPath(issues, t).name, 'validation.required');
  });

  it('words a contract refinement by the i18n key it names', () => {
    const issues = firstIssues(createBudgetSchema, {
      walletId: '00000000-0000-4000-8000-000000000000',
      name: 'Food',
      amount: '100',
      currency: 'VND',
      periodType: 'CUSTOM',
      startDate: '2026-10-23',
      endDate: '2026-10-01',
    });
    assert.equal(fieldErrorKey(issues.find((issue) => issue.path[0] === 'endDate')!).key, 'validation.endBeforeStart');
    assert.equal(fieldErrorKey(firstIssue(positiveAmountSchema, '0')).key, 'validation.amountPositive');
  });

  it('finds every i18n key the contracts name in en.ts', () => {
    const source = readFileSync(new URL('../../../packages/contracts/src/schemas.ts', import.meta.url), 'utf8');
    const keys = [...source.matchAll(/i18nKey: '([\w.]+)'/g)].map((match) => match[1]!);
    assert.ok(keys.length > 0);
    const validation = en.validation as Record<string, string>;
    for (const key of keys) {
      const [namespace, name] = key.split('.');
      assert.equal(namespace, 'validation', key);
      assert.equal(typeof validation[name!], 'string', key);
    }
  });
});
