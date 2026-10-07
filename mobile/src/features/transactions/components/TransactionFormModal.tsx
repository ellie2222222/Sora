import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Banknote } from 'lucide-react-native';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import {
  BottomSheetModal,
  Button,
  CalculatorKeypad,
  DatePickerModal,
  IconChip,
  Input,
  KeypadSheetFooter,
  SheetScrollArea,
  Skeleton,
  StateView,
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
  today,
  emptyDraft,
  categoryTypeFor,
  draftFromTransaction,
  expressionOfAmount,
  fieldsForType,
  primaryAccountOf,
  setPrimaryAccount,
  switchType,
  updateBodyOf,
  validateDraft,
} from '@/utils';
import { useCreateTransactionMutation, useGetTransactionQuery, useUpdateTransactionMutation } from '@/app/store';

export interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Edits this transaction: the same form, filled with its values, saving through an update instead of a create. */
  transactionId?: string;
  /** The sheet this one was opened from, when there is one to return to. */
  onBack?: () => void;
  /** Closes that sheet too, from the header's Close. */
  onCloseAll?: () => void;
}

/** The wallet whose categories and accounts the form offers: the one the transaction is paid from, or into for income. */
function walletOf(transaction: TransactionResponse): string | undefined {
  return transaction.type === TransactionType.INCOME ? transaction.toAccount?.walletId : transaction.fromAccount?.walletId;
}

export function TransactionFormModal({ visible, onClose, transactionId, onBack, onCloseAll }: TransactionFormModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeWallet, wallets, timeZone: activeTimeZone, permissions, isLoading: walletsLoading } = useWallets();
  const [createTransaction, { isLoading: isCreating }] = useCreateTransactionMutation();
  const [updateTransaction, { isLoading: isUpdating }] = useUpdateTransactionMutation();

  const isEdit = transactionId !== undefined;
  const existing = useGetTransactionQuery(transactionId ?? '', { skip: !visible || !isEdit });
  // `currentData`: another transaction's values must never fill this one's form.
  const record = isEdit ? existing.currentData : undefined;

  const [draft, setDraft] = useState(() => emptyDraft({ currency: 'VND', transactionDate: nowInstant() }));
  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [toAccountWalletId, setToAccountWalletId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);

  const walletId = isEdit ? (record === undefined ? undefined : walletOf(record)) : activeWallet?.id;
  // The day picked is the transaction's own wallet's, which an edit opened from another wallet may not share.
  const timeZone = wallets.find((wallet) => wallet.id === walletId)?.timeZone ?? activeTimeZone;
  const fields = fieldsForType(draft.type);
  const primaryAccount = primaryAccountOf(draft);
  const title = isEdit ? t('transactions.editTransaction') : t('home.addTransaction');
  const sheet = { visible, onClose, title, onBack, onCloseAll };

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
      setFilledFrom(null);
    }
  }, [visible, activeWallet?.id, transactionId]);

  useEffect(() => {
    if (!visible || record === undefined || filledFrom === record.id) return;
    setDraft(draftFromTransaction(record));
    setExpression(expressionOfAmount(record.amount));
    setToAccountWalletId(record.toAccount?.walletId);
    setFilledFrom(record.id);
  }, [visible, record, filledFrom]);

  const crossWallet =
    draft.type === TransactionType.TRANSFER && toAccountWalletId !== undefined && toAccountWalletId !== walletId;

  const selectedDay = dayOfInstant(draft.transactionDate, timeZone);
  const dateLabel = formatShortDay(selectedDay);
  const dateAccessibilityLabel = `${t('transactions.date', 'Date')}, ${formatDay(selectedDay)}`;

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef) so the keypad's grid identity stays
  // stable even though these two closures change every keystroke/render. Declared before the
  // early returns below so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => setDatePickerOpen(true);

  // Gate only once the wallets query has actually resolved — while it's still loading,
  // `activeWallet` (and thus `permissions.canWrite`) is transiently null/false for every
  // role, including the wallet's own owner, and would otherwise flash this notice at them.
  if (!walletsLoading && !permissions.canWrite) {
    return (
      <BottomSheetModal {...sheet}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {t('transactions.viewOnlyNotice', {
              defaultValue: 'You can view this wallet, but adding transactions needs Editor access.',
            })}
          </Text>
        </View>
      </BottomSheetModal>
    );
  }

  if (isEdit && record === undefined && existing.isError) {
    return (
      <BottomSheetModal {...sheet}>
        <StateView variant="error" error={existing.error} retryAction={() => void existing.refetch()} testID="edit-transaction-error" entrance="none" />
      </BottomSheetModal>
    );
  }

  if (isEdit && (record === undefined || filledFrom !== record.id)) {
    return (
      <BottomSheetModal {...sheet} closeLabel="cancel" entity="transaction">
        <TransactionFormSkeleton />
      </BottomSheetModal>
    );
  }

  if (record?.status === TransactionStatus.DELETED) {
    return (
      <BottomSheetModal {...sheet}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            {t('transactions.cancelledNotice', { defaultValue: "This transaction was deleted, so it can't be edited. Record a new one instead." })}
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
      if (record === undefined) {
        await createTransaction(result.payload).unwrap();
        showToast(t('toast.transactionAdded', { defaultValue: 'Transaction added' }), 'success');
      } else {
        const body = updateBodyOf(record, result.payload);
        if (Object.keys(body).length > 0) {
          await updateTransaction({ transactionId: record.id, body }).unwrap();
          showToast(t('toast.transactionUpdated', { defaultValue: 'Transaction updated' }), 'success');
        }
      }
      onClose();
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  function handleConfirm() {
    const amount = confirm();
    if (amount !== null) void handleSubmit(amount);
  }

  return (
    <BottomSheetModal {...sheet} closeLabel="cancel" entity="transaction">
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
                onChange={(accountId, _walletId, currency) =>
                  setDraft((current) => ({ ...current, fromAccountId: accountId, currency }))
                }
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
                      defaultValue: "This sends money to another wallet, so it'll show up in their records too.",
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
              onChange={(accountId, _walletId, currency) =>
                setDraft((current) => ({ ...setPrimaryAccount(current, accountId), currency }))
              }
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
          placeholder={t('transactions.notePlaceholder', { defaultValue: 'Add a note' })}
          value={draft.description}
          onChangeText={(text) => setDraft((current) => ({ ...current, description: text }))}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          onConfirmRef={onConfirmRef}
          confirmDisabled={isCreating || isUpdating}
          onQuickDateRef={onQuickDateRef}
          dateLabel={dateLabel}
          dateAccessibilityLabel={dateAccessibilityLabel}
          testID="keypad-transaction"
        />
      </KeypadSheetFooter>

      <DatePickerModal
        visible={datePickerOpen}
        today={today(timeZone)}
        selectedDay={selectedDay}
        onSelectDay={(day) =>
          setDraft((current) => ({ ...current, transactionDate: replaceDay(current.transactionDate, day, timeZone) }))
        }
        onClose={() => setDatePickerOpen(false)}
      />
    </BottomSheetModal>
  );
}

/** While an edited transaction loads; shaped like the form so nothing jumps when it fills (DESIGN_GUIDELINES Part 2). */
function TransactionFormSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}>
      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        {[0, 1, 2].map((key) => (
          <View key={key} style={{ flex: 1 }}>
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
      <Skeleton width="100%" height={theme.sizes.skeletonLine.display} radius={theme.radius.sm} />
      <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
    </View>
  );
}
