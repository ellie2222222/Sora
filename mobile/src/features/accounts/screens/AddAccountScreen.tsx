import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ACCOUNT_TYPES, type AccountType } from '@sora/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useCreateAccountMutation } from '../../../app/store/api/accountsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const TYPE_LABEL: Record<AccountType, string> = {
  BANK_ACCOUNT: 'Bank account',
  CASH: 'Cash',
  E_WALLET: 'E-wallet',
  CREDIT_CARD: 'Credit card',
};

export function AddAccountScreen({ route, navigation }: AppStackScreenProps<'AddAccount'>) {
  const theme = useTheme();
  const { activeWallet } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK_ACCOUNT');
  const [currency, setCurrency] = useState(activeWallet?.balances[0]?.currency ?? 'VND');
  const [initialBalance, setInitialBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  if (walletId === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text tone="muted">No wallet selected.</Text>
      </View>
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
      setError(messageOf(submitError));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <Input testID="add-account-name" label="Name" placeholder="e.g. Vietcombank VND" value={name} onChangeText={setName} />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            Type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
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

        <Input testID="add-account-currency" label="Currency" autoCapitalize="characters" maxLength={3} value={currency} onChangeText={setCurrency} />

        <Input
          testID="add-account-initial-balance"
          label={type === 'CREDIT_CARD' ? 'Opening balance (negative if you owe)' : 'Opening balance'}
          keyboardType="numbers-and-punctuation"
          value={initialBalance}
          onChangeText={setInitialBalance}
        />

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-account-submit"
          label="Add account"
          onPress={handleSubmit}
          loading={isCreating}
          disabled={name.trim().length === 0}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
