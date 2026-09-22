import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, AccountType } from '@sora/contracts';

import { BottomSheetModal, Button, Input, MoneyInput, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useCreateAccountMutation } from '@/app/store';
import { messageOf } from '@/utils';
import type { AppStackScreenProps } from '@/app/navigation';

export function AddAccountScreen({ route, navigation }: AppStackScreenProps<'AddAccount'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.BANK_ACCOUNT);
  const [currency, setCurrency] = useState(activeWallet?.balances[0]?.currency ?? 'VND');
  const [initialBalance, setInitialBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABEL: Record<AccountType, string> = {
    [AccountType.BANK_ACCOUNT]: t('accounts.bankAccount', { defaultValue: 'Bank account' }),
    [AccountType.CASH]: t('accounts.cash', { defaultValue: 'Cash' }),
    [AccountType.E_WALLET]: t('accounts.eWallet', { defaultValue: 'E-wallet' }),
    [AccountType.CREDIT_CARD]: t('accounts.creditCard', { defaultValue: 'Credit card' }),
  };

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={true} onClose={() => navigation.goBack()} title={t('accounts.addAccount')}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted">{t('accounts.noWalletSelected', { defaultValue: 'No wallet selected.' })}</Text>
        </View>
      </BottomSheetModal>
    );
  }

  async function handleSubmit() {
    setError(null);
    try {
      await createAccount({
        walletId: walletId as string,
        name,
        type,
        currency,
        initialBalance,
      }).unwrap();
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={true} onClose={() => navigation.goBack()} title={t('accounts.addAccount')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
          <Input testID="add-account-name" label={t('categories.name', { defaultValue: 'Name' })} placeholder={t('accounts.namePlaceholder', 'e.g. Vietcombank VND')} value={name} onChangeText={setName} />

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('transactions.type', { defaultValue: 'Type' })}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: theme.spacing.xs }}>
              {ACCOUNT_TYPES.map((candidate) => (
                <Button
                  key={candidate}
                  testID={`add-account-type-${candidate}`}
                  label={TYPE_LABEL[candidate]}
                  size="sm"
                  variant={type === candidate ? 'primary' : 'secondary'}
                  onPress={() => setType(candidate)}
                />
              ))}
            </View>
          </View>

          <Input testID="add-account-currency" label={t('accounts.currency', { defaultValue: 'Currency' })} autoCapitalize="characters" maxLength={3} value={currency} onChangeText={setCurrency} />

          <MoneyInput
            testID="add-account-initial-balance"
            label={type === AccountType.CREDIT_CARD ? t('accounts.openingBalanceCreditCard', { defaultValue: 'Opening balance (negative if you owe)' }) : t('accounts.openingBalance', { defaultValue: 'Opening balance' })}
            value={initialBalance}
            onChangeValue={setInitialBalance}
          />

          {error !== null ? <Text tone="danger">{error}</Text> : null}

          <Button
            testID="add-account-submit"
            label={t('accounts.addAccount')}
            onPress={handleSubmit}
            loading={isCreating}
            disabled={name.trim().length === 0}
            fullWidth
          />
        </ScrollView>
    </BottomSheetModal>
  );
}
