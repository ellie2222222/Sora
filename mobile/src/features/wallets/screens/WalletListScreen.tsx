import { Plus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletResponse } from '@sora/contracts';

import { BottomSheetModal, Button, Card, Input, Money, StateView, Text } from '../../../components';
import { SkeletonList } from '../../../components/Skeleton';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useWallets } from '../../../app/providers/WalletProvider';
import { useCreateWalletMutation } from '../../../app/store/api/walletsApi';
import { ROLE_LABELS } from '../../../utils/roles';
import { messageOf } from '../../../utils/errors';
import type { AppStackScreenProps } from '../../../app/navigation/types';


/**
 * The full manage-wallets surface: your own wallets, everything shared with
 * you, and the entry point to create a new one.
 */
export function WalletListScreen({ navigation }: AppStackScreenProps<'WalletList'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { wallets, isLoading, isError, refetch, setActiveWalletId } = useWallets();
  const [creating, setCreating] = useState(false);

  const own = wallets.filter((w) => w.isOwn);
  const shared = wallets.filter((w) => !w.isOwn);

  const renderContent = () => {
    if (isLoading) return <SkeletonList rows={4} rowHeight={72} />;
    if (isError) return <StateView variant="error" error={new Error(t('common.error'))} retryAction={refetch} />;

    return (
      <FlatList
        testID="wallet-list"
        data={[...own, ...shared]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
            <Text variant="title">{t('wallets.title')}</Text>
            {!isGuest ? (
              <Button
                testID="wallet-list-create"
                label={t('wallets.newWallet')}
                size="sm"
                onPress={() => setCreating(true)}
              />
            ) : null}
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
    );
  };

  return (
    <>
      {renderContent()}
      <CreateWalletModal visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function WalletRow({ wallet, onPress }: { wallet: WalletResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable testID={`wallet-list-item-${wallet.id}`} onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flex: 1 }}>
            {!wallet.isOwn ? <UsersRound size={18} color={theme.colors.primary} /> : null}
            <View style={{ flex: 1 }}>
              <Text weight="semibold">
                {wallet.isOwn
                  ? (wallet.name === 'Guest Wallet' ? t('wallets.guestWallet') : wallet.name)
                  : wallet.relationLabel ?? (wallet.name === 'Guest Wallet' ? t('wallets.guestWallet') : wallet.name)}
              </Text>
              <Text variant="caption" tone="muted">
                {wallet.isOwn
                  ? t('wallets.memberCount', { count: wallet.memberCount })
                  : `${wallet.name === 'Guest Wallet' ? t('wallets.guestWallet') : wallet.name} · ${ROLE_LABELS[wallet.role]}`}
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
  const { t } = useTranslation();
  const [createWallet, { isLoading: isCreating }] = useCreateWalletMutation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    try {
      await createWallet({ name }).unwrap();
      setName('');
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('wallets.newWallet')}>
      <View style={{ gap: theme.spacing.md }}>
        <Input
          testID="create-wallet-name"
          label={t('categories.name', { defaultValue: 'Name' })}
          placeholder={t('wallets.walletNamePlaceholder')}
          value={name}
          onChangeText={setName}
        />
        {error !== null ? <Text tone="danger">{error}</Text> : null}
        <Button
          testID="create-wallet-submit"
          label={t('common.create')}
          onPress={handleCreate}
          loading={isCreating}
          disabled={name.trim().length === 0}
          fullWidth
        />
      </View>
    </BottomSheetModal>
  );
}
