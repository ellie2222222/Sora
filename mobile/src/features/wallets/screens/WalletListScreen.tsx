import { Plus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import type { WalletResponse } from '@finance/contracts';

import { Button, Card, ErrorState, Input, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { ROLE_LABELS } from '../../../utils/roles.ts';
import { messageOf } from '../../../utils/errors.ts';
import { useCreateWallet } from '../hooks/useWallets.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

/**
 * The full manage-wallets surface: your own wallets, everything shared with
 * you, and the entry point to create a new one. `WalletSwitcher` (on Home) is
 * the quick-switch version of this same list.
 */
export function WalletListScreen({ navigation }: AppStackScreenProps<'WalletList'>) {
  const theme = useTheme();
  const { wallets, isLoading, isError, refetch, setActiveWalletId } = useWallets();
  const [creating, setCreating] = useState(false);

  if (isLoading) return <SkeletonList rows={4} rowHeight={72} />;
  if (isError) return <ErrorState error={new Error('Could not load wallets')} onRetry={refetch} />;

  const own = wallets.filter((w) => w.isOwn);
  const shared = wallets.filter((w) => !w.isOwn);

  return (
    <>
      <FlatList
        testID="wallet-list"
        data={[...own, ...shared]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
            <Text variant="title">Wallets</Text>
            <Button
              testID="wallet-list-create"
              label="New wallet"
              size="sm"
              onPress={() => setCreating(true)}
            />
          </View>
        }
        renderItem={({ item }) => (
          <WalletRow
            wallet={item}
            onPress={() => {
              setActiveWalletId(item.id);
              navigation.navigate('WalletDetail', { walletId: item.id });
            }}
          />
        )}
      />
      <CreateWalletModal visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function WalletRow({ wallet, onPress }: { wallet: WalletResponse; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable testID={`wallet-list-item-${wallet.id}`} onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flex: 1 }}>
            {!wallet.isOwn ? <UsersRound size={18} color={theme.colors.primary} /> : null}
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{wallet.isOwn ? wallet.name : wallet.relationLabel ?? wallet.name}</Text>
              <Text variant="caption" tone="muted">
                {wallet.isOwn ? `${wallet.memberCount} member${wallet.memberCount === 1 ? '' : 's'}` : `${wallet.name} · ${ROLE_LABELS[wallet.role]}`}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {wallet.balances.map((total) => (
              <Money key={total.currency} amount={total.amount} currency={total.currency} variant="label" />
            ))}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function CreateWalletModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const createWallet = useCreateWallet();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    try {
      await createWallet.mutateAsync({ name });
      setName('');
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card elevated style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: theme.spacing.md }}>
              <Text variant="title">New wallet</Text>
              <Input
                testID="create-wallet-name"
                label="Name"
                placeholder="e.g. Mom's Money"
                value={name}
                onChangeText={setName}
              />
              {error !== null ? <Text tone="danger">{error}</Text> : null}
              <Button
                testID="create-wallet-submit"
                label="Create"
                onPress={handleCreate}
                loading={createWallet.isPending}
                disabled={name.trim().length === 0}
                fullWidth
              />
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
