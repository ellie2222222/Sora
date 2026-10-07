import { sql, type RawBuilder } from 'kysely';

import { DEFAULT_LOCALE, requestLocale } from '../common/request-locale.ts';

/**
 * A category's display name for the current request: a starter category's translation in the
 * request locale, then in English, then its stored name; a custom category (no `system_key`)
 * is always its stored name, exactly as typed. `table` is the categories table's name or alias.
 */
export function localizedCategoryName(table: string): RawBuilder<string> {
  const systemKey = sql.ref(`${table}.system_key`);
  const translated = (locale: string) =>
    sql`(SELECT ct.name FROM category_translations ct WHERE ct.system_key = ${systemKey} AND ct.locale = ${locale})`;
  return sql<string>`COALESCE(${translated(requestLocale())}, ${translated(DEFAULT_LOCALE)}, ${sql.ref(`${table}.name`)})`;
}
