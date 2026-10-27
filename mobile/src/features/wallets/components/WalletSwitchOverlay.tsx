import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Wallet as WalletIcon } from 'lucide-react-native';
import type { WalletResponse } from '@sora/contracts';

import { Text, ThemedIcon } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { selectAnyQueryPending } from '@/app/store';

/** Long enough for the new wallet's screens to start their reads, so "nothing pending" means loaded. */
const MIN_SHOWN_MS = 450;
/** A read that never answers (offline, a slow server) must not trap the user behind the overlay. */
const MAX_SHOWN_MS = 6000;

/**
 * Covers the app while a wallet switch loads, so the old wallet's figures never show under the new one's name.
 * One screen per switch (keyed by wallet), so each switch gets its own timers and a refetch never restarts them.
 */
export function WalletSwitchOverlay() {
  const { switchingTo } = useWallets();
  if (switchingTo === null) return null;
  return <SwitchingScreen key={switchingTo.id} wallet={switchingTo} />;
}

function SwitchingScreen({ wallet }: { wallet: WalletResponse }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { finishSwitch } = useWallets();
  const anyPending = useSelector(selectAnyQueryPending);
  const [minElapsed, setMinElapsed] = useState(false);
  const walletId = wallet.id;

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), MIN_SHOWN_MS);
    const max = setTimeout(() => finishSwitch(walletId), MAX_SHOWN_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [walletId, finishSwitch]);

  useEffect(() => {
    if (minElapsed && !anyPending) finishSwitch(walletId);
  }, [minElapsed, anyPending, walletId, finishSwitch]);

  return (
    <Animated.View
      testID="overlay-wallet-switch"
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      accessibilityLiveRegion="polite"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
        theme.motion.colorTransition,
      ]}
    >
      <ThemedIcon icon={WalletIcon} size={theme.iconSize.xxl} color={theme.colors.primary} />
      <Text weight="semibold" style={{ fontSize: theme.fontSize.lg }}>
        {t('wallets.switchingTo', { name: wallet.name })}
      </Text>
      <ActivityIndicator color={theme.colors.primary} />
    </Animated.View>
  );
}
