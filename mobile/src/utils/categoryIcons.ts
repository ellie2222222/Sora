/**
 * Maps a category's `icon` (a kebab-case lucide name, e.g. "shopping-bag" —
 * see `packages/contracts/src/starter-categories.ts`) to the matching
 * `lucide-react-native` component. Custom categories may carry an icon name
 * outside this set, or none at all; callers fall back to initials for those.
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftRight,
  Award,
  Banknote,
  Briefcase,
  Building2,
  Bus,
  Clapperboard,
  CircleEllipsis,
  Clock,
  Coffee,
  CreditCard,
  CupSoda,
  Cookie,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HandCoins,
  Handshake,
  HeartPulse,
  Home,
  Landmark,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Undo2,
  Utensils,
  Wallet,
  Wrench,
  Zap,
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
  coffee: Coffee,
  zap: Zap,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  wrench: Wrench,
  'building-2': Building2,
  percent: Percent,
  award: Award,
  'undo-2': Undo2,
  clapperboard: Clapperboard,
  cookie: Cookie,
  'cup-soda': CupSoda,
  'credit-card': CreditCard,
  'hand-coins': HandCoins,
  clock: Clock,
  'piggy-bank': PiggyBank,
  handshake: Handshake,
  wallet: Wallet,
  landmark: Landmark,
};

/** The icon for a TRANSFER row regardless of its optional category, so a transfer never reads as income or expense. */
export const TRANSFER_ICON: LucideIcon = ArrowLeftRight;

export function categoryIconFor(icon: string | null | undefined): LucideIcon | null {
  if (!icon) return null;
  return CATEGORY_ICONS[icon] ?? null;
}
