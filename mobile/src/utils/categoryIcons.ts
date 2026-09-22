/**
 * Maps a category's `icon` (a kebab-case lucide name, e.g. "shopping-bag" —
 * see `packages/contracts/src/starter-categories.ts`) to the matching
 * `lucide-react-native` component. Custom categories may carry an icon name
 * outside this set, or none at all; callers fall back to initials for those.
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Bus,
  CircleEllipsis,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  Receipt,
  Repeat,
  Shield,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Utensils,
} from 'lucide-react-native';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  banknote: Banknote,
  'circle-ellipsis': CircleEllipsis,
  home: Home,
  'shopping-cart': ShoppingCart,
  'heart-pulse': HeartPulse,
  film: Film,
  'graduation-cap': GraduationCap,
  plane: Plane,
  repeat: Repeat,
  shield: Shield,
  briefcase: Briefcase,
  'trending-up': TrendingUp,
  gift: Gift,
};

/** The icon for a TRANSFER row regardless of category — money moving is never a category concern. */
export const TRANSFER_ICON: LucideIcon = ArrowLeftRight;

export function categoryIconFor(icon: string | null | undefined): LucideIcon | null {
  if (!icon) return null;
  return CATEGORY_ICONS[icon] ?? null;
}
