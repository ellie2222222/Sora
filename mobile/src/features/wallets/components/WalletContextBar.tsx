import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { WalletSwitcher } from './WalletSwitcher.tsx';

/**
 * Thin wrapper so every screen that shows money renders the same wallet-
 * context row Home already does — SRS §6.2: the wallet in context must be
 * visible everywhere, never inferred from memory.
 *
 * With `children`, wraps them in one `flex: 1` column below the bar — every
 * consumer screen has 3-4 branches (loading/error/empty/success) that all
 * need the same bar-above-content shell, so this collapses each branch back
 * to one line instead of repeating the wrapper `View` per branch.
 */
export function WalletContextBar({ onManage, children }: { onManage?: () => void; children?: ReactNode }) {
  const theme = useTheme();

  const bar = (
    <View
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xs,
      }}
    >
      <WalletSwitcher onManage={onManage} />
    </View>
  );

  if (children === undefined) return bar;
  return (
    <View style={{ flex: 1 }}>
      {bar}
      {children}
    </View>
  );
}
