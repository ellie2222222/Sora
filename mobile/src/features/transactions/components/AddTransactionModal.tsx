import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Banknote } from 'lucide-react-native';
import { TransactionType } from '@sora/contracts';

import {
  BottomSheetModal,
  Button,
  CalculatorKeypad,
  DatePickerModal,
  IconChip,
  Input,
  KeypadSheetFooter,
  SheetFormHeader,
  SheetScrollArea,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
// Deep-imported (not via each feature's barrel): this component is itself deep-imported by
// ModalProvider to avoid a cycle (see its own comment), so pulling in `@/features/accounts` or
// `@/features/categories` here would reintroduce one through their barrels' other exports.
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import {
  messageOf,
  dayOfInstant,
  formatDay,
  formatShortDay,
  nowInstant,
  replaceDay,
  emptyDraft,
  categoryTypeFor,
  fieldsForType,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  validateDraft,
} from '@/utils';
import { useCreateTransactionMutation } from '@/app/store';

export interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeWallet, permissions, isLoading: walletsLoading } = useWallets();
  const [createTransaction, { isLoading: isSubmitting }] = useCreateTransactionMutation();

  const [draft, setDraft] = useState(() => emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [toAccountWalletId, setToAccountWalletId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const walletId = activeWallet?.id;
  const fields = fieldsForType(draft.type);
  const primaryAccount = primaryAccountOf(draft);

  const TYPES = [
    { type: TransactionType.EXPENSE, label: t('transactions.filterExpense', { defaultValue: 'Expense' }), icon: ArrowUpFromLine },
    { type: TransactionType.INCOME, label: t('transactions.filterIncome', { defaultValue: 'Income' }), icon: ArrowDownToLine },
    { type: TransactionType.TRANSFER, label: t('transactions.filterTransfer', { defaultValue: 'Transfer' }), icon: ArrowRightLeft },
  ];

  useEffect(() => {
    if (visible) {
      setDraft(emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
      setExpression('');
      setToAccountWalletId(undefined);
      setFieldErrors({});
      setSubmitError(null);
      setDatePickerOpen(false);
    }
  }, [visible, walletId]);

  const crossWallet =
    draft.type === TransactionType.TRANSFER && toAccountWalletId !== undefined && toAccountWalletId !== walletId;

  const selectedDay = dayOfInstant(draft.transactionDate);
  const dateLabel = formatShortDay(selectedDay);
  const dateAccessibilityLabel = `${t('transactions.date', 'Date')}, ${formatDay(selectedDay)}`;

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef) so the keypad's grid identity stays
  // stable even though these two closures change every keystroke/render. Declared before the
  // early return below so every render calls the same hooks regardless of `permissions.canWrite`.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => setDatePickerOpen(true);

  // Gate only once the wallets query has actually resolved — while it's still loading,
  // `activeWallet` (and thus `permissions.canWrite`) is transiently null/false for every
  // role, including the wallet's own owner, and would otherwise flash this notice at them.
  if (!walletsLoading && !permissions.canWrite) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('home.addTransaction')}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {t('transactions.viewOnlyNotice', {
              defaultValue: 'You have view-only access to this wallet and cannot record transactions.',
            })}
          </Text>
        </View>
      </BottomSheetModal>
    );
  }

  async function handleSubmit(amount: string) {
    setSubmitError(null);
    const withAmount = { ...draft, amount };
    const result = validateDraft(withAmount);

    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const issue of result.issues) {
        // An unpicked account fails as Zod's raw "Expected string, received null".
        const unpickedAccount =
          (issue.path === 'fromAccountId' || issue.path === 'toAccountId') && withAmount[issue.path] === null;
        next[issue.path] = unpickedAccount ? t('accounts.selectAccount') : issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await createTransaction(result.payload).unwrap();
      onClose();
      showToast(t('toast.transactionAdded', { defaultValue: 'Transaction added' }), 'success');
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  function handleConfirm() {
    const amount = confirm();
    if (amount !== null) void handleSubmit(amount);
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <SheetFormHeader title={t('home.addTransaction')} onCancel={onClose} entity="transaction" />

      <View className="flex-row" style={{ flexShrink: 0, gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        {TYPES.map(({ type, label, icon }) => (
          <Button
            key={type}
            testID={`btn-transaction-type-${type}`}
            label={label}
            icon={icon}
            variant={draft.type === type ? 'primary' : 'secondary'}
            onPress={() => setDraft((current) => switchType(current, type))}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      <SheetScrollArea>
          {draft.type === TransactionType.TRANSFER ? (
            <>
              <AccountPicker
                testID="picker-from-account"
                label={t('transactions.fromLabel', { defaultValue: 'From' })}
                walletId={walletId}
                value={draft.fromAccountId}
                onChange={(accountId) => setDraft((current) => ({ ...current, fromAccountId: accountId }))}
                error={fieldErrors.fromAccountId}
              />
              <AccountPicker
                testID="picker-to-account"
                label={t('transactions.toLabel', { defaultValue: 'To' })}
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
                    {t('transactions.crossWalletNotice', {
                      defaultValue: 'This moves money into another wallet. It will appear in their ledger too.',
                    })}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {fields.category && walletId !== undefined ? (
            <CategoryGrid
              testID="picker-category"
              walletId={walletId}
              type={categoryTypeFor(draft.type)}
              optional={draft.type === TransactionType.TRANSFER}
              value={draft.categoryId}
              onChange={(categoryId) => setDraft((current) => ({ ...current, categoryId }))}
              error={fieldErrors.categoryId}
            />
          ) : null}
      </SheetScrollArea>

      <KeypadSheetFooter
        leading={
          draft.type === TransactionType.TRANSFER ? (
            <IconChip icon={Banknote} label={draft.currency} testID="transaction-currency" />
          ) : (
            <AccountPicker
              compact
              testID="picker-account"
              label={t('accounts.accountLabel', { defaultValue: 'Account' })}
              walletId={walletId}
              value={primaryAccount}
              onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            />
          )
        }
        amount={displayAmount}
        amountTestID="transaction-amount-display"
        errors={[
          draft.type !== TransactionType.TRANSFER ? (fieldErrors.fromAccountId ?? fieldErrors.toAccountId) : undefined,
          fieldErrors.amount,
        ]}
      >
        <Input
          testID="input-transaction-description"
          placeholder={t('transactions.notePlaceholder', { defaultValue: 'Enter a note...' })}
          value={draft.description}
          onChangeText={(text) => setDraft((current) => ({ ...current, description: text }))}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          onConfirmRef={onConfirmRef}
          confirmDisabled={isSubmitting}
          onQuickDateRef={onQuickDateRef}
          dateLabel={dateLabel}
          dateAccessibilityLabel={dateAccessibilityLabel}
          testID="keypad-transaction"
        />
      </KeypadSheetFooter>

      <DatePickerModal
        visible={datePickerOpen}
        selectedDay={selectedDay}
        onSelectDay={(day) =>
          setDraft((current) => ({ ...current, transactionDate: replaceDay(current.transactionDate, day) }))
        }
        onClose={() => setDatePickerOpen(false)}
      />
    </BottomSheetModal>
  );
}
