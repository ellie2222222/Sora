import { ChevronDown, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import type { WalletResponse } from '@finance/contracts';

import { Card, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { ROLE_LABELS } from '../../../utils/roles.ts';

/**
 * The product's headline surface: every wallet you own, alongside every one
 * shared with you, each showing how you relate to it. A friend's/partner's
 * wallet must read as unmistakably theirs — same list, same tap-to-switch, but
 * never confusable with your own.
 */
export function WalletSwitcher({ onManage }: { onManage?: () => void }) {
  const theme = useTheme();
  const { wallets, activeWallet, setActiveWalletId, isLoading } = useWallets();
  const [open, setOpen] = useState(false);

  if (isLoading || activeWallet === null) {
    return (
      <View style={{ height: 28, width: 160, borderRadius: theme.radius.sm, backgroundColor: theme.colors.skeleton }} />
    );
  }

  return (
    <>
      <Pressable
        testID="wallet-switcher-open"
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
      >
        {!activeWallet.isOwn ? <UsersRound size={16} color={theme.colors.primary} /> : null}
        <Text variant="title" numberOfLines={1}>
          {activeWallet.isOwn ? activeWallet.name : activeWallet.relationLabel ?? activeWallet.name}
        </Text>
        <ChevronDown size={18} color={theme.colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.colors.overlay }}
          onPress={() => setOpen(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card
                elevated
                style={{
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  maxHeight: '70%',
                  gap: theme.spacing.xs,
                }}
              >
                <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
                  Wallets
                </Text>
                {wallets.map((wallet) => (
                  <WalletRow
                    key={wallet.id}
                    wallet={wallet}
                    active={wallet.id === activeWallet.id}
                    onPress={() => {
                      setActiveWalletId(wallet.id);
                      setOpen(false);
                    }}
                  />
                ))}
                {onManage !== undefined ? (
                  <Pressable
                    testID="wallet-switcher-manage"
                    onPress={() => {
                      setOpen(false);
                      onManage();
                    }}
                    style={{ paddingVertical: theme.spacing.md }}
                  >
                    <Text tone="muted">Manage wallets…</Text>
                  </Pressable>
                ) : null}
              </Card>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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

  return (
    <Pressable
      testID={`wallet-switcher-item-${wallet.id}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: active ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {!wallet.isOwn ? <UsersRound size={16} color={theme.colors.textMuted} /> : null}
        <View>
          <Text weight={active ? 'semibold' : 'regular'}>
            {wallet.isOwn ? wallet.name : wallet.relationLabel ?? wallet.name}
          </Text>
          {!wallet.isOwn ? (
            <Text variant="caption" tone="muted">
              {wallet.name} · {ROLE_LABELS[wallet.role]}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Your wallet
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
