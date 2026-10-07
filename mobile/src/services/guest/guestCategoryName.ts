import { localizedCategoryName } from '@sora/contracts';

// Relative, not `@/services/locale`: guest modules run under bare `node --test`, which has no path aliases.
import { activeLocale } from '../locale/activeLocale.ts';
import type { GuestCategory } from './guestStore.ts';

/** What the server's `localizedCategoryName` SQL returns, read from the same STARTER_CATEGORIES the migration mirrors. */
export function guestCategoryName(category: Pick<GuestCategory, 'name' | 'systemKey'>): string {
  return localizedCategoryName({ name: category.name, systemKey: category.systemKey ?? null }, activeLocale());
}
