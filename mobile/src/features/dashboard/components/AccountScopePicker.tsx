import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccountStatus } from '@sora/contracts';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListAccountsQuery } from '@/app/store';

const ALL = 'all';

/** Narrows the dashboard to one account; hidden while the wallet has only one account to show. */
export function AccountScopePicker({
  walletId,
  selectedAccountId,
  onSelect,
}: {
  walletId: string;
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const items = accounts.data ?? [];
  if (items.length < 2) return null;

  const options = [
    { key: ALL, label: t('dashboard.allAccounts'), accountId: null },
    ...items.map((account) => ({ key: account.id, label: account.name, accountId: account.id })),
  ];

  return (
    <ScrollView
      testID="picker-dashboard-account"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.xs }}
    >
      {options.map((option) => {
        const selected = option.accountId === selectedAccountId;
        const pressed = pressedKey === option.key;
        return (
          <Pressable
            key={option.key}
            testID={`option-account-${option.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.accountId)}
            onPressIn={() => setPressedKey(option.key)}
            onPressOut={() => setPressedKey(null)}
            style={{
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: selected ? theme.colors.primaryMuted : pressed ? theme.colors.surfaceMuted : theme.colors.surface,
            }}
          >
            <Text variant="caption" weight={selected ? 'semibold' : 'regular'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
