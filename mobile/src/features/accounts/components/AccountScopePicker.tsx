import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ellipsis, Layers } from 'lucide-react-native';
import { AccountStatus } from '@sora/contracts';

import { BottomSheetModal, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListAccountsQuery } from '@/app/store';
import { inlineAccounts, overflowsScopeRow } from '../accountScope.ts';
import { AccountOption, AccountOptionRow } from './AccountPicker.tsx';

const ALL = 'all';
const MORE = 'more';

/**
 * Narrows a view to one account. Hidden while the wallet has only one account to show, unless a filter
 * is set: an account archived since leaves "All" as the only way back.
 */
export function AccountScopePicker({
  walletId,
  selectedAccountId,
  onSelect,
  testID,
}: {
  walletId: string;
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
  testID: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Not `data`: across a wallet switch it still holds the old wallet's accounts, which this would offer as scopes.
  const items = accounts.currentData ?? [];
  if (items.length < 2 && selectedAccountId === null) return null;

  const chips = [
    { key: ALL, label: t('dashboard.allAccounts'), accountId: null },
    ...inlineAccounts(items, selectedAccountId).map((account) => ({ key: account.id, label: account.name, accountId: account.id })),
  ];

  // Only the chosen chip gets a surface: a filter should sit back from the figures it filters.
  const chipStyle = (key: string, selected: boolean) => ({
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: selected ? theme.colors.primaryMuted : pressedKey === key ? theme.colors.surfacePressed : 'transparent',
  });

  const pick = (accountId: string | null) => {
    setSheetOpen(false);
    onSelect(accountId);
  };

  return (
    <View testID={testID} className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
      {chips.map((chip) => {
        const selected = chip.accountId === selectedAccountId;
        return (
          <Pressable
            key={chip.key}
            testID={`btn-account-scope-${chip.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(chip.accountId)}
            onPressIn={() => setPressedKey(chip.key)}
            onPressOut={() => setPressedKey(null)}
            hitSlop={{ top: theme.sizes.hitSlop.md, bottom: theme.sizes.hitSlop.md }}
            // An account name ellipsizes rather than pushing the row past the screen edge.
            style={[chipStyle(chip.key, selected), { flexShrink: chip.accountId === null ? 0 : 1 }]}
          >
            <Text variant="label" weight={selected ? 'semibold' : 'medium'} tone={selected ? undefined : 'muted'} numberOfLines={1} style={selected ? { color: theme.colors.primary } : undefined}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}

      {overflowsScopeRow(items.length) ? (
        <Pressable
          testID="btn-more-account-scope"
          accessibilityRole="button"
          accessibilityLabel={t('accounts.moreAccounts')}
          onPress={() => setSheetOpen(true)}
          onPressIn={() => setPressedKey(MORE)}
          onPressOut={() => setPressedKey(null)}
          hitSlop={{ top: theme.sizes.hitSlop.md, bottom: theme.sizes.hitSlop.md }}
          className="items-center justify-center"
          style={[chipStyle(MORE, false), { alignSelf: 'stretch' }]}
        >
          <Ellipsis size={theme.iconSize.sm} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}

      <BottomSheetModal visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('accounts.filterByAccount')} entity="account-scope">
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: theme.sizes.listMaxHeight.md }}
          contentContainerStyle={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.md }}
        >
          <AccountOptionRow
            icon={Layers}
            label={t('dashboard.allAccounts')}
            selected={selectedAccountId === null}
            onPress={() => pick(null)}
            testID={`option-account-scope-${ALL}`}
          />
          {items.map((account) => (
            <AccountOption
              key={account.id}
              account={account}
              walletName={undefined}
              selected={account.id === selectedAccountId}
              onPress={() => pick(account.id)}
              testID={`option-account-scope-${account.id}`}
            />
          ))}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}
