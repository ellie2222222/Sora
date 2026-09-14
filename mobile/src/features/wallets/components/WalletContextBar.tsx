import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../app/providers/ThemeProvider';
import { WalletSwitcher } from './WalletSwitcher';
import { OfflineBanner } from '../../../components/OfflineBanner';

/**
 * Thin wrapper so every screen that shows money renders the same wallet-
 * context row Home already does — SRS §6.2: the wallet in context must be
 * visible everywhere, never inferred from memory.
 *
 * Automatically includes the non-blocking OfflineBanner below the bar.
 */
export function WalletContextBar({
  onManage,
  rightContent,
  children,
}: {
  onManage?: () => void;
  rightContent?: ReactNode;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bar = (
    <View style={{ backgroundColor: theme.colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.md,
          // MainTabNavigator has `headerShown: false`, so this bar must clear the status bar itself.
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <WalletSwitcher onManage={onManage} />
        {rightContent}
      </View>
      <OfflineBanner />
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

