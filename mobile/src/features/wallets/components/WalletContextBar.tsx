import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/app/providers';
import { WalletSwitcher } from './WalletSwitcher';
import { ConnectionSyncStatus } from '@/components';

/**
 * Thin wrapper so every screen that shows money renders the same wallet-context
 * row — SRS §6.2: the wallet in context must be visible everywhere, never inferred from memory.
 *
 * Connection/sync status is communicated only via the small icons on the
 * far right — no banner, toast, or full-screen state for normal
 * connectivity/sync issues (every screen stays usable offline).
 */
export function WalletContextBar({
  rightContent,
  children,
}: {
  rightContent?: ReactNode;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bar = (
    <View style={{ backgroundColor: theme.colors.background }}>
      <View
        className="flex-row justify-between items-center"
        style={{
          paddingHorizontal: theme.spacing.md,
          // The tab screens render no header, so this bar clears the status bar itself.
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <WalletSwitcher />
        <View className="flex-row items-center" style={{ gap: theme.spacing.md }}>
          {rightContent}
          <ConnectionSyncStatus />
        </View>
      </View>
    </View>
  );

  if (children === undefined) return bar;
  return (
    <View className="flex-1">
      {bar}
      {children}
    </View>
  );
}

