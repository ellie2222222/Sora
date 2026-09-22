import { Banknote, Check, ChevronDown, CreditCard, Landmark, Wallet as WalletIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AccountResponse, AccountType } from '@sora/contracts';

import { BottomSheetModal, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useListAccountsQuery } from '@/app/store';

export const ACCOUNT_ICON: Record<AccountType, typeof Landmark> = {
  BANK_ACCOUNT: Landmark,
  CASH: Banknote,
  E_WALLET: WalletIcon,
  CREDIT_CARD: CreditCard,
};

export interface AccountPickerProps {
  label: string;
  value: string | null;
  onChange: (accountId: string, walletId: string) => void;
  walletId?: string;
  error?: string;
  testID?: string;
  /** Renders as a small icon+name pill instead of a full labeled field — for a spot where the
   * account only needs a quick swap, not a dedicated form row (e.g. next to an amount). `label`
   * still names the picker's modal title; there's just nowhere to show it inline. */
  compact?: boolean;
}

export function AccountPicker({ label, value, onChange, walletId, error, testID, compact = false }: AccountPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const accounts = useListAccountsQuery({ walletId, status: 'ACTIVE' });

  // Deliberate default-to-first-account UX shortcut, not just an init step:
  // clearing `value` back to empty while the list is already loaded will
  // immediately re-populate it with the first account, not leave it blank.
  useEffect(() => {
    const list = accounts.data;
    if ((value === null || value === undefined || value === '') && list !== undefined && list.length > 0) {
      const first = list[0];
      if (first !== undefined) {
        onChange(first.id, first.walletId);
      }
    }
  }, [accounts.data, value, onChange]);

  const selected = accounts.data?.find((a) => a.id === value);
  const walletNameOf = (id: string): string => wallets.find((w) => w.id === id)?.name ?? '';
  const AccountTypeIcon = selected !== undefined ? ACCOUNT_ICON[selected.type] : Banknote;

  return (
    <View style={compact ? undefined : { gap: theme.spacing.xs }}>
      {compact ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Pressable
            testID={testID}
            onPress={() => setOpen(true)}
            className="flex-row items-center"
            style={{ gap: theme.spacing.xs }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: error !== undefined ? theme.colors.dangerMuted : theme.colors.warningMuted,
              }}
            >
              <AccountTypeIcon size={16} color={error !== undefined ? theme.colors.danger : theme.colors.warning} strokeWidth={2} />
            </View>
            <Text
              tone={selected === undefined ? 'faint' : 'default'}
              numberOfLines={1}
              style={{ maxWidth: 120 }}
            >
              {selected === undefined ? t('accounts.selectAccount', { defaultValue: 'Select an account' }) : selected.name}
            </Text>
            <ChevronDown size={14} color={theme.colors.textMuted} />
          </Pressable>
          {error !== undefined ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
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
            <View className="flex-row justify-between items-center">
              <Text tone={selected === undefined ? 'faint' : 'default'}>
                {selected === undefined ? t('accounts.selectAccount', { defaultValue: 'Select an account' }) : selected.name}
              </Text>
              <ChevronDown size={18} color={theme.colors.textMuted} />
            </View>
          </Pressable>
          {error !== undefined ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </>
      )}

      <BottomSheetModal
        visible={open}
        onClose={() => setOpen(false)}
        title={label || t('accounts.selectAccount', { defaultValue: 'Select an account' })}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className="max-h-[360px]"
          contentContainerStyle={{ gap: 4, paddingBottom: theme.spacing.md }}
        >
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
            <Text tone="faint" style={{ padding: theme.spacing.md, textAlign: 'center' }}>
              {t('accounts.noAccountsHereYet', { defaultValue: 'No accounts here yet.' })}
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheetModal>
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
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
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
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
        <Money amount={account.balance} currency={account.currency} variant="label" />
        {selected ? <Check size={16} color={theme.colors.primary} /> : null}
      </View>
    </Pressable>
  );
}
