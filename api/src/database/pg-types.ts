/**
 * Postgres → JS type mapping for the driver.
 *
 * `pg` parses several column types into JS numbers by default, which is exactly
 * the failure money.ts exists to prevent: DECIMAL(19,4) reaches past 2^53, so a
 * float64 round-trip silently changes a balance. These parsers hand back the raw
 * text and let parseMoney/formatMoney do the arithmetic on scaled bigints.
 *
 * DATE is also kept as text: budget windows are compared by calendar day, and a
 * Date object drags the process timezone into a comparison that must not depend
 * on it.
 */

import pg from 'pg';

const PG_OID = {
  INT8: 20,
  NUMERIC: 1700,
  DATE: 1082,
} as const;

const asText = (value: string): string => value;

let configured = false;

export function configurePgTypeParsers(): void {
  if (configured) return;

  pg.types.setTypeParser(PG_OID.NUMERIC, asText);
  pg.types.setTypeParser(PG_OID.INT8, asText);
  pg.types.setTypeParser(PG_OID.DATE, asText);

  configured = true;
}

/**
 * Assert the parsers are actually installed on the driver this process will use.
 *
 * A parser registered against the wrong `pg` module instance (a duplicated copy
 * in node_modules) leaves the defaults in place with no error anywhere — the
 * symptom is a balance that is off by a rounding error nobody can trace.
 */
export function verifyPgTypeParsers(): void {
  configurePgTypeParsers();

  const checks: Array<[string, number, string]> = [
    ['NUMERIC', PG_OID.NUMERIC, '150000.0000'],
    ['INT8', PG_OID.INT8, '9007199254740993'],
    ['DATE', PG_OID.DATE, '2026-08-22'],
  ];

  for (const [label, oid, sample] of checks) {
    const parsed = pg.types.getTypeParser(oid, 'text' as never)(sample) as unknown;
    if (typeof parsed !== 'string' || parsed !== sample) {
      throw new Error(
        `pg type parser for ${label} (OID ${oid}) is not returning strings — got ${typeof parsed} ${String(parsed)}`,
      );
    }
  }
}
