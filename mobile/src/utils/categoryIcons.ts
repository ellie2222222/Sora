/**
 * Maps a category's `icon` (a kebab-case lucide name, e.g. "shopping-bag" —
 * see `packages/contracts/src/starter-categories.ts`) to the matching
 * `lucide-react-native` component. Custom categories may carry an icon name
 * outside this set, or none at all; callers fall back to initials for those.
 */
import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeftRight, Banknote, Bus, CircleEllipsis, Receipt, ShoppingBag, Utensils } from 'lucide-react-native';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  banknote: Banknote,
  'circle-ellipsis': CircleEllipsis,
};

/** The icon for a TRANSFER row regardless of category — money moving is never a category concern. */
export const TRANSFER_ICON: LucideIcon = ArrowLeftRight;

export function categoryIconFor(icon: string | null | undefined): LucideIcon | null {
  if (!icon) return null;
  return CATEGORY_ICONS[icon] ?? null;
}
