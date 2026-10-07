import { Banknote, Check, ChevronDown, CreditCard, Landmark, Wallet as WalletIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AccountResponse, AccountType } from '@sora/contracts';
import { AccountStatus } from '@sora/contracts';

import { BottomSheetModal, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useListAccountsQuery } from '@/app/store';
import { useDefaultToFirst } from '@/hooks';

export const ACCOUNT_ICON: Record<AccountType, typeof Landmark> = {
  BANK_ACCOUNT: Landmark,
  CASH: Banknote,
  E_WALLET: WalletIcon,
  CREDIT_CARD: CreditCard,
};

export const ACCOUNT_TYPE_LABEL_KEY: Record<AccountType, string> = {
  BANK_ACCOUNT: 'accounts.bankAccount',
  CASH: 'accounts.cash',
  E_WALLET: 'accounts.eWallet',
  CREDIT_CARD: 'accounts.creditCard',
};

export interface AccountPickerProps {
  label: string;
  value: string | null;
  onChange: (accountId: string, walletId: string, currency: string) => void;
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
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });

  useDefaultToFirst(accounts.data, value, (first) => onChange(first.id, first.walletId, first.currency));

  const selected = accounts.data?.find((a) => a.id === value);
  const walletNameOf = (id: string): string => wallets.find((w) => w.id === id)?.name ?? '';
  const AccountTypeIcon = selected !== undefined ? ACCOUNT_ICON[selected.type] : Banknote;
  const selectedLabel = selected?.name ?? t('accounts.selectAccount', { defaultValue: 'Pick an account' });
  const fieldAccessibilityLabel = label.length > 0 ? `${label}, ${selectedLabel}` : selectedLabel;

  return (
    <View style={compact ? undefined : { gap: theme.spacing.xs }}>
      {compact ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Pressable
            testID={testID}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={fieldAccessibilityLabel}
            className="flex-row items-center"
            style={{ gap: theme.spacing.xs, minHeight: theme.sizes.touchTarget }}
          >
            <View
              style={{
                width: theme.sizes.badge.sm,
                height: theme.sizes.badge.sm,
                borderRadius: theme.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: error !== undefined ? theme.colors.dangerMuted : theme.colors.warningMuted,
              }}
            >
              <AccountTypeIcon size={theme.iconSize.md} color={error !== undefined ? theme.colors.danger : theme.colors.warning} />
            </View>
            <ChevronDown size={theme.iconSize.sm} color={theme.colors.textMuted} />
            <Text
              tone={selected === undefined ? 'faint' : 'default'}
              numberOfLines={1}
              style={{ maxWidth: theme.sizes.chipLabelMaxWidth }}
            >
              {selected === undefined ? t('accounts.selectAccount', { defaultValue: 'Pick an account' }) : selected.name}
            </Text>
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
            accessibilityRole="button"
            accessibilityLabel={fieldAccessibilityLabel}
            style={{
              height: theme.sizes.controlHeight,
              borderRadius: theme.radius.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: error !== undefined ? theme.colors.danger : theme.colors.borderControl,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
              <ChevronDown size={theme.iconSize.lg} color={theme.colors.textMuted} />
              <Text tone={selected === undefined ? 'faint' : 'default'}>
                {selected === undefined ? t('accounts.selectAccount', { defaultValue: 'Pick an account' }) : selected.name}
              </Text>
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
        title={label || t('accounts.selectAccount', { defaultValue: 'Pick an account' })}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: theme.sizes.listMaxHeight.md }}
          contentContainerStyle={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.md }}
        >
          {(accounts.data ?? []).map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              walletName={walletId === undefined ? walletNameOf(account.walletId) : undefined}
              selected={account.id === value}
              onPress={() => {
                onChange(account.id, account.walletId, account.currency);
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

function AccountItem({
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
      testID={`option-account-${account.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: theme.sizes.controlHeight,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <Icon size={theme.iconSize.lg} color={theme.colors.textMuted} />
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
        {selected ? <Check size={theme.iconSize.md} color={theme.colors.primary} /> : null}
      </View>
    </Pressable>
  );
}
