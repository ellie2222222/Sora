import { View } from 'react-native';
import { TransactionType, type TransactionType as TxType } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { categoryIconFor, TRANSFER_ICON } from '@/utils';
import { Text } from './Text.tsx';

export interface CategoryAvatarProps {
  categoryIcon?: string | null;
  categoryName?: string | null;
  transactionType: TxType;
  /** The category's colour, or a fallback — tints the icon/initial only, never a border. */
  tint: string;
  size?: number;
  testID?: string;
}

/**
 * The compact identity mark on a transaction row or its detail view: the
 * category's lucide icon when `icon` maps to one, else its first initial.
 * Deliberately borderless and background-muted so the icon/letter — not the
 * shape around it — carries the identity, and the row stays readable next to
 * the coloured amount instead of competing with it.
 */
export function CategoryAvatar({ categoryIcon, categoryName, transactionType, tint, size = 36, testID }: CategoryAvatarProps) {
  const theme = useTheme();
  const Icon = transactionType === TransactionType.TRANSFER ? TRANSFER_ICON : categoryIconFor(categoryIcon);
  const initialSource = categoryIcon || categoryName || transactionType;
  const initial = initialSource.slice(0, 1).toUpperCase();

  return (
    <View
      testID={testID}
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {Icon !== null ? (
        <Icon size={size * 0.5} color={tint} strokeWidth={2} />
      ) : (
        <Text weight="semibold" style={{ color: tint, fontSize: size * 0.4 }}>
          {initial}
        </Text>
      )}
    </View>
  );
}
