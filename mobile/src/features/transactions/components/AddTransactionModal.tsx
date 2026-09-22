import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banknote } from 'lucide-react-native';
import { formatCurrencyInput, formatMoney, formatMoneyCompact, TransactionType, CategoryType } from '@sora/contracts';

import { BottomSheetModal, Button, CalculatorKeypad, DatePickerModal, Input, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
// Deep-imported (not via each feature's barrel): this component is itself deep-imported by
// ModalProvider to avoid a cycle (see its own comment), so pulling in `@/features/accounts` or
// `@/features/categories` here would reintroduce one through their barrels' other exports.
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import {
  messageOf,
  dayOfInstant,
  formatDay,
  nowInstant,
  replaceDay,
  today,
  emptyDraft,
  fieldsForType,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  validateDraft,
  hasOperator as hasOperatorGlyph,
  hasTrailingOperator,
  spaceExpression,
  tryEvaluate,
} from '@/utils';
import { useCreateTransactionMutation } from '@/app/store';

export interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet, permissions, isLoading: walletsLoading } = useWallets();
  const [createTransaction, { isLoading: isSubmitting }] = useCreateTransactionMutation();

  const [draft, setDraft] = useState(() => emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
  const [expression, setExpression] = useState('');
  const expressionRef = useRef(expression);
  expressionRef.current = expression;
  const [toAccountWalletId, setToAccountWalletId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const walletId = activeWallet?.id;
  const fields = fieldsForType(draft.type);
  const primaryAccount = primaryAccountOf(draft);

  const TYPES: { type: TransactionType; label: string }[] = [
    { type: TransactionType.EXPENSE, label: t('transactions.filterExpense', { defaultValue: 'Expense' }) },
    { type: TransactionType.INCOME, label: t('transactions.filterIncome', { defaultValue: 'Income' }) },
    { type: TransactionType.TRANSFER, label: t('transactions.filterTransfer', { defaultValue: 'Transfer' }) },
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

  const hasOperator = hasOperatorGlyph(expression);
  const evaluated = useMemo(() => tryEvaluate(expression), [expression]);
  // Mirrors MoneyInput's own rule: an operator expression only becomes a real amount once it's
  // evaluated (see handleConfirm below), so it contributes nothing here while still mid-typing.
  const committedAmount = !hasOperator && evaluated !== null ? formatMoney(evaluated) : '';

  const displayAmount = useMemo(() => {
    if (expression.trim() === '') return '0';
    if (hasOperator) return spaceExpression(expression);
    if (evaluated === null) return expression;
    const negative = evaluated < 0n;
    const magnitude = negative ? -evaluated : evaluated;
    const formatted = formatCurrencyInput(formatMoneyCompact(magnitude, 0), true);
    return negative ? `-${formatted}` : formatted;
  }, [evaluated, expression, hasOperator]);

  const crossWallet =
    draft.type === TransactionType.TRANSFER && toAccountWalletId !== undefined && toAccountWalletId !== walletId;

  const selectedDay = dayOfInstant(draft.transactionDate);
  const dateLabel =
    selectedDay === today() ? t('common.today', { defaultValue: 'Today' }) : formatDay(selectedDay);

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
      for (const issue of result.issues) next[issue.path] = issue.message;
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await createTransaction(result.payload).unwrap();
      onClose();
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  /**
   * Two-stage: an operator expression is evaluated (or, if it ends in a dangling operator, just
   * trimmed back to its last complete term) on the first tap and the sheet stays open so the
   * result can be reviewed — only a plain, already-complete number submits and closes it. Each
   * tap performs exactly one of strip/evaluate/submit, never two in sequence.
   */
  function handleConfirm() {
    const trimmed = expression.trim();
    if (trimmed === '' || !hasOperator) {
      void handleSubmit(trimmed === '' ? '' : committedAmount);
      return;
    }
    if (hasTrailingOperator(trimmed)) {
      setExpression(trimmed.slice(0, -1));
      return;
    }
    if (evaluated === null) return; // incomplete (e.g. unmatched parenthesis) — keep editing
    setExpression(formatMoney(evaluated));
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.sm }}>
        <Pressable
          testID="transaction-cancel"
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        >
          <Text tone="muted">{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
        </Pressable>
        <Text variant="title">{t('home.addTransaction')}</Text>
        <Text tone="muted" variant="caption" style={{ minWidth: 40, textAlign: 'right' }}>
          {draft.currency}
        </Text>
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
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

      <View style={{ flexShrink: 1, minHeight: 0 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          {draft.type === TransactionType.TRANSFER ? (
            <>
              <AccountPicker
                testID="transaction-from-account"
                label={t('transactions.fromLabel', { defaultValue: 'From' })}
                walletId={walletId}
                value={draft.fromAccountId}
                onChange={(accountId) => setDraft((current) => ({ ...current, fromAccountId: accountId }))}
                error={fieldErrors.fromAccountId}
              />
              <AccountPicker
                testID="transaction-to-account"
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
              testID="transaction-category"
              walletId={walletId}
              type={draft.type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE}
              value={draft.categoryId}
              onChange={(categoryId) => setDraft((current) => ({ ...current, categoryId }))}
              error={fieldErrors.categoryId}
            />
          ) : null}
        </ScrollView>
      </View>

      <View
        style={{
          flexShrink: 0,
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
          paddingTop: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <View className="flex-row items-end justify-between">
          {draft.type === TransactionType.TRANSFER ? (
            <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: theme.radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.warningMuted,
                }}
              >
                <Banknote size={16} color={theme.colors.warning} strokeWidth={2} />
              </View>
              <Text tone="muted">{draft.currency}</Text>
            </View>
          ) : (
            <AccountPicker
              compact
              testID="transaction-account"
              label={t('accounts.accountLabel', { defaultValue: 'Account' })}
              walletId={walletId}
              value={primaryAccount}
              onChange={(accountId) => setDraft((current) => setPrimaryAccount(current, accountId))}
            />
          )}
          <Text variant="heading" numeric weight="bold" testID="transaction-amount-display">
            {displayAmount}
          </Text>
        </View>
        {draft.type !== TransactionType.TRANSFER && (fieldErrors.fromAccountId ?? fieldErrors.toAccountId) !== undefined ? (
          <Text variant="caption" tone="danger">
            {fieldErrors.fromAccountId ?? fieldErrors.toAccountId}
          </Text>
        ) : null}
        {fieldErrors.amount !== undefined ? (
          <Text variant="caption" tone="danger">
            {fieldErrors.amount}
          </Text>
        ) : null}

        <Input
          testID="transaction-description"
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
          testID="transaction-amount-keypad"
        />
      </View>

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
