import { Landmark, Wallet as WalletIcon, CreditCard, Banknote } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { AccountResponse, AccountType } from '@sora/contracts';

import { Card, Money, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useListAccountsQuery } from '../../../app/store/api/accountsApi.ts';

const ACCOUNT_ICON: Record<AccountType, typeof Landmark> = {
  BANK_ACCOUNT: Landmark,
  CASH: Banknote,
  E_WALLET: WalletIcon,
  CREDIT_CARD: CreditCard,
};

export interface AccountPickerProps {
  label: string;
  value: string | null;
  onChange: (accountId: string, walletId: string) => void;
  /**
   * Restrict to one wallet (the common case). Omit to browse every wallet the
   * user can reach — used for a transfer's destination, which may legitimately
   * sit in someone else's wallet.
   */
  walletId?: string;
  error?: string;
  testID?: string;
}

export function AccountPicker({ label, value, onChange, walletId, error, testID }: AccountPickerProps) {
  const theme = useTheme();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const accounts = useListAccountsQuery({ walletId, status: 'ACTIVE' });

  const selected = accounts.data?.find((a) => a.id === value);
  const walletNameOf = (id: string): string => wallets.find((w) => w.id === id)?.name ?? '';

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={{
          height: 48,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
        }}
      >
        <Text tone={selected === undefined ? 'faint' : 'default'}>
          {selected === undefined ? 'Select an account' : selected.name}
        </Text>
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card
                elevated
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '70%' }}
              >
                <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
                  {label}
                </Text>
                <ScrollView>
                  {(accounts.data ?? []).map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      walletName={walletId === undefined ? walletNameOf(account.walletId) : undefined}
                      selected={account.id === value}
                      onPress={() => {
                        onChange(account.id, account.walletId);
                        setOpen(false);
                      }}
                    />
                  ))}
                  {accounts.data !== undefined && accounts.data.length === 0 ? (
                    <Text tone="faint" style={{ paddingVertical: theme.spacing.md }}>
                      No accounts here yet.
                    </Text>
                  ) : null}
                </ScrollView>
              </Card>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function AccountRow({
  account,
  walletName,
  selected,
  onPress,
}: {
  account: AccountResponse;
  walletName: string | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const Icon = ACCOUNT_ICON[account.type];

  return (
    <Pressable
      testID={`account-picker-item-${account.id}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon size={18} color={theme.colors.textMuted} />
        <View>
          <Text weight={selected ? 'semibold' : 'regular'}>{account.name}</Text>
          {walletName !== undefined ? (
            <Text variant="caption" tone="muted">
              {walletName}
            </Text>
          ) : null}
        </View>
      </View>
      <Money amount={account.balance} currency={account.currency} variant="label" />
    </Pressable>
  );
}
