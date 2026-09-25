import { Check, ChevronDown, UsersRound, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletResponse } from '@sora/contracts';

import { BottomSheetModal, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { ROLE_LABELS } from '@/utils';

/**
 * The product's headline surface: every wallet you own, alongside every one
 * shared with you, each showing how you relate to it.
 */
export function WalletSwitcher({ onManage }: { onManage?: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { wallets, activeWallet, setActiveWalletId, isLoading } = useWallets();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
        <View
          className="w-[18px] h-[18px]"
          style={{ borderRadius: theme.radius.pill, backgroundColor: theme.colors.skeleton }}
        />
        <View
          className="h-[20px] w-[120px]"
          style={{ borderRadius: theme.radius.sm, backgroundColor: theme.colors.skeleton }}
        />
        <View
          className="w-[18px] h-[18px]"
          style={{ borderRadius: theme.radius.sm, backgroundColor: theme.colors.skeleton }}
        />
      </View>
    );
  }

  const currentWallet = activeWallet ?? wallets[0] ?? null;
  const formatWalletName = (name: string) => (name === 'Guest Wallet' ? t('wallets.guestWallet') : name);
  const displayName = currentWallet
    ? currentWallet.isOwn
      ? formatWalletName(currentWallet.name)
      : currentWallet.relationLabel ?? formatWalletName(currentWallet.name)
    : t('wallets.yourWallet', { defaultValue: 'Your wallet' });

  return (
    <>
      <Pressable
        testID="picker-wallet"
        onPress={() => setOpen(true)}
        className="flex-row items-center"
        style={{ gap: theme.spacing.xs }}
      >
        {currentWallet && !currentWallet.isOwn ? (
          <UsersRound size={16} color={theme.colors.primary} />
        ) : (
          <Wallet size={18} color={theme.colors.primary} />
        )}
        <Text variant="title" numberOfLines={1}>
          {displayName}
        </Text>
        <ChevronDown size={18} color={theme.colors.textMuted} />
      </Pressable>

      <BottomSheetModal visible={open} onClose={() => setOpen(false)} title={t('wallets.title')}>
        <View style={{ gap: theme.spacing.xs }}>
          {wallets.map((wallet) => (
            <WalletRow
              key={wallet.id}
              wallet={wallet}
              active={wallet.id === activeWallet?.id}
              onPress={() => {
                setActiveWalletId(wallet.id);
                setOpen(false);
              }}
            />
          ))}
          {onManage !== undefined ? (
            <Pressable
              testID="btn-manage-wallets"
              onPress={() => {
                setOpen(false);
                onManage();
              }}
              style={{ paddingVertical: theme.spacing.md }}
            >
              <Text tone="muted">{t('wallets.manageWallets', { defaultValue: 'Manage wallets…' })}</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheetModal>
    </>
  );
}

function WalletRow({
  wallet,
  active,
  onPress,
}: {
  wallet: WalletResponse;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const formatWalletName = (name: string) => (name === 'Guest Wallet' ? t('wallets.guestWallet') : name);
  const displayName = wallet.isOwn ? formatWalletName(wallet.name) : wallet.relationLabel ?? formatWalletName(wallet.name);

  return (
    <Pressable
      testID={`option-wallet-${wallet.id}`}
      onPress={onPress}
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: active ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        {!wallet.isOwn ? <UsersRound size={16} color={theme.colors.textMuted} /> : null}
        <View>
          <Text weight={active ? 'semibold' : 'regular'}>
            {displayName}
          </Text>
          {!wallet.isOwn ? (
            <Text variant="caption" tone="muted">
              {formatWalletName(wallet.name)} · {ROLE_LABELS[wallet.role]}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {t('wallets.yourWallet', { defaultValue: 'Your wallet' })}
            </Text>
          )}
        </View>
      </View>
      {active ? <Check size={16} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}
