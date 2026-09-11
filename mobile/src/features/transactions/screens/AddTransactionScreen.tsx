import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { TransactionType } from '@sora/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { messageOf } from '../../../utils/errors.ts';
import { nowInstant } from '../../../utils/date.ts';
import {
  emptyDraft,
  fieldsForType,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  validateDraft,
} from '../../../utils/transactionForm.ts';
import { useCreateTransactionMutation } from '../../../app/store/api/transactionsApi.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const TYPES: { type: TransactionType; label: string }[] = [
  { type: 'EXPENSE', label: 'Expense' },
  { type: 'INCOME', label: 'Income' },
  { type: 'TRANSFER', label: 'Transfer' },
];

export function AddTransactionScreen({ navigation }: AppStackScreenProps<'AddTransaction'>) {
  const theme = useTheme();
  const { activeWallet, permissions } = useWallets();
  const [createTransaction, { isLoading: isSubmitting }] = useCreateTransactionMutation();

  const [draft, setDraft] = useState(() => emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
  const [amountText, setAmountText] = useState('');
  const [toAccountWalletId, setToAccountWalletId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const walletId = activeWallet?.id;
  const fields = fieldsForType(draft.type);
  const primaryAccount = primaryAccountOf(draft);

  // Switching the active wallet mid-draft would leave a picked account/category
  // pointing at the wallet just left behind, so start a clean draft instead of
  // silently submitting against the wrong wallet's data.
  useEffect(() => {
    setDraft(emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
    setAmountText('');
    setToAccountWalletId(undefined);
    setFieldErrors({});
    setSubmitError(null);
    // Deliberately keyed on walletId alone: this must run once per wallet
    // switch, not on every keystroke that updates the draft it resets.
  }, [walletId]);

  // The "to" side of a transfer is browsed with no walletId filter (it may
  // legitimately sit in someone else's wallet); the picker hands back which
  // wallet was picked from, and comparing that against the active wallet is
  // simpler and more direct than re-deriving it from an account id afterward.
  const crossWallet =
    draft.type === 'TRANSFER' && toAccountWalletId !== undefined && toAccountWalletId !== walletId;

  const onManage = () => navigation.navigate('WalletList');

  if (!permissions.canWrite) {
    return (
      <WalletContextBar onManage={onManage}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            You have view-only access to this wallet and cannot record transactions.
          </Text>
        </View>
      </WalletContextBar>
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    const withAmount = { ...draft, amount: amountText };
    const result = validateDraft(withAmount);

    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const issue of result.issues) next[issue.path] = issue.message;
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await createTransaction(result.payload).unwrap();
      navigation.goBack();
    } catch (error) {
      setSubmitError(messageOf(error));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WalletContextBar onManage={onManage} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {TYPES.map(({ type, label }) => (
            <Button
              key={type}
              testID={`transaction-type-${type}`}
              label={label}
              variant={draft.type === type ? 'primary' : 'secondary'}
              onPress={() => setDraft((current) => switchType(current, type))}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <Input
          testID="transaction-amount"
          label="Amount"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
          error={fieldErrors.amount}
        />

        {fields.fromAccount && draft.type !== 'TRANSFER' ? (
          <AccountPicker
            testID="transaction-from-account"
            label="Account"
            walletId={walletId}
            value={primaryAccount}
            onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            error={fieldErrors.fromAccountId}
          />
        ) : null}

        {fields.toAccount && draft.type !== 'TRANSFER' ? (
          <AccountPicker
            testID="transaction-to-account"
            label="Account"
            walletId={walletId}
            value={primaryAccount}
            onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            error={fieldErrors.toAccountId}
          />
        ) : null}

        {draft.type === 'TRANSFER' ? (
          <>
            <AccountPicker
              testID="transaction-from-account"
              label="From"
              walletId={walletId}
              value={draft.fromAccountId}
              onChange={(accountId) => setDraft((current) => ({ ...current, fromAccountId: accountId }))}
              error={fieldErrors.fromAccountId}
            />
            <AccountPicker
              testID="transaction-to-account"
              label="To"
              value={draft.toAccountId}
              onChange={(accountId, pickedWalletId) => {
                setDraft((current) => ({ ...current, toAccountId: accountId }));
                setToAccountWalletId(pickedWalletId);
              }}
              error={fieldErrors.toAccountId}
            />
            {crossWallet ? (
              <View
                style={{
                  backgroundColor: theme.colors.warningMuted,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                }}
              >
                <Text variant="caption" tone="muted">
                  This moves money into another wallet. It will appear in their ledger too.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {fields.category && walletId !== undefined ? (
          <CategoryPicker
            testID="transaction-category"
            walletId={walletId}
            type={draft.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
            value={draft.categoryId}
            onChange={(categoryId) => setDraft((current) => ({ ...current, categoryId }))}
            error={fieldErrors.categoryId}
          />
        ) : null}

        <Input
          testID="transaction-description"
          label="Note"
          value={draft.description}
          onChangeText={(text) => setDraft((current) => ({ ...current, description: text }))}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <Button
          testID="transaction-submit"
          label="Save"
          onPress={handleSubmit}
          loading={isSubmitting}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
