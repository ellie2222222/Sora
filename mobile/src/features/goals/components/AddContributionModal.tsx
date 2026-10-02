import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { createContributionSchema } from '@sora/contracts';

import {
  BottomSheetModal,
  CalculatorKeypad,
  DatePickerModal,
  Input,
  KeypadSheetFooter,
  SheetFormHeader,
  SheetScrollArea,
  Skeleton,
  StateView,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast } from '@/app/providers';
// Deep-imported (not via each feature's barrel): this component is itself deep-imported by
// ModalProvider, and pulling in `@/features/accounts` or `@/features/categories` here
// reintroduces a cycle through their barrels' other exports (same reasoning as
// AddTransactionModal.tsx's identical comment).
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import { useAddContributionMutation, useGetGoalQuery } from '@/app/store';
import {
  formatDay,
  formatShortDay,
  instantOfDay,
  isNetworkError,
  issueMessagesByPath,
  messageOf,
  today,
  type CalendarDay,
} from '@/utils';

export interface AddContributionModalProps {
  visible: boolean;
  goalId?: string;
  onClose: () => void;
}

export function AddContributionModal({ visible, goalId, onClose }: AddContributionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const goal = useGetGoalQuery(goalId ?? '', { skip: !visible || !goalId });
  const [addContribution, { isLoading: isSubmitting }] = useAddContributionMutation();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [contributionDay, setContributionDay] = useState<CalendarDay>(today());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [recordAsTransaction, setRecordAsTransaction] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setExpression('');
      setAccountId(null);
      setWalletId(undefined);
      setContributionDay(today());
      setDatePickerOpen(false);
      setNote('');
      setRecordAsTransaction(true);
      setCategoryId(null);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible, goalId]);

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef): keeps the keypad grid's identity stable.
  // Declared before the early returns so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => setDatePickerOpen(true);

  if (!visible || !goalId) return null;

  if (goal.isLoading) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
                <View style={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={80} height={14} radius={theme.radius.sm} />
            <Skeleton width="100%" height={48} radius={theme.radius.md} />
          </View>
          
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={60} height={14} radius={theme.radius.sm} />
            <Skeleton width="100%" height={48} radius={theme.radius.md} />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={100} height={14} radius={theme.radius.sm} />
            <Skeleton width="100%" height={48} radius={theme.radius.md} />
          </View>
          
          <Skeleton width="100%" height={240} radius={theme.radius.md} />
        </View>
      </BottomSheetModal>
    );
  }

  if (goal.isError && !isNetworkError(goal.error)) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.addContribution')}>
        <StateView variant="error" error={goal.error} retryAction={() => void goal.refetch()} testID="add-contribution-error" />
      </BottomSheetModal>
    );
  }

  const goalData = goal.data;
  if (goalData === undefined) return null;

  async function handleSubmit(amount: string) {
    if (!goalData || !goalId) return;
    setSubmitError(null);

    const parsed = createContributionSchema.safeParse({
      accountId,
      amount,
      currency: goalData.currency,
      contributionDate: instantOfDay(contributionDay),
      note: note.trim() || undefined,
      recordAsTransaction,
      categoryId: recordAsTransaction ? (categoryId ?? undefined) : undefined,
    });
    if (!parsed.success) {
      const next = issueMessagesByPath(parsed.error.issues);
      if (next.accountId !== undefined) {
        next.accountId = t('goals.chooseAccountError', { defaultValue: 'Choose which account this comes from.' });
      }
      if (next.amount !== undefined) {
        next.amount = t('goals.validAmountError', { defaultValue: 'Enter a valid amount greater than zero.' });
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await addContribution({ goalId, body: parsed.data }).unwrap();
      onClose();
      showToast(t('toast.contributionAdded', { defaultValue: 'Contribution added' }), 'success');
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
      <SheetFormHeader title={t('goals.addContribution')} onCancel={onClose} entity="contribution" />

      <SheetScrollArea>
        <Pressable
          testID="input-contribution-record-transaction"
          onPress={() => setRecordAsTransaction((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: recordAsTransaction }}
          className="flex-row items-center"
          style={{ gap: theme.spacing.sm }}
        >
          <View
            className="w-[20px] h-[20px] items-center justify-center border-[1.5px]"
            style={{
              borderRadius: theme.radius.sm,
              borderColor: recordAsTransaction ? theme.colors.primary : theme.colors.borderControl,
              backgroundColor: recordAsTransaction ? theme.colors.primary : 'transparent',
            }}
          >
            {recordAsTransaction ? <Check size={14} color={theme.colors.onPrimary} /> : null}
          </View>
          <View className="flex-1">
            <Text weight="medium">
              {t('goals.recordAsExpense', { defaultValue: 'Record as an expense' })}
            </Text>
            <Text variant="caption" tone="muted">
              {t('goals.recordAsExpenseHelp', {
                defaultValue:
                  'Moves the money out of the account now. Leave unchecked to just mark progress toward the goal without recording a transaction.',
              })}
            </Text>
          </View>
        </Pressable>

        {recordAsTransaction ? (
          <CategoryGrid
            testID="picker-category"
            walletId={walletId ?? goalData.walletId}
            type="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
            error={fieldErrors.categoryId}
          />
        ) : null}
      </SheetScrollArea>

      <KeypadSheetFooter
        leading={
          <AccountPicker
            compact
            testID="picker-account"
            label={t('goals.fromAccount', { defaultValue: 'From account' })}
            value={accountId}
            onChange={(id, selectedWalletId) => {
              setAccountId(id);
              setWalletId(selectedWalletId);
            }}
          />
        }
        amount={displayAmount}
        amountTestID="add-contribution-amount-display"
        errors={[fieldErrors.accountId, fieldErrors.amount]}
      >
        <Input
          testID="input-contribution-note"
          placeholder={t('transactions.notePlaceholder', { defaultValue: 'Enter a note...' })}
          value={note}
          onChangeText={setNote}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          onConfirmRef={onConfirmRef}
          confirmDisabled={isSubmitting}
          onQuickDateRef={onQuickDateRef}
          dateLabel={formatShortDay(contributionDay)}
          dateAccessibilityLabel={`${t('transactions.date', { defaultValue: 'Date' })}, ${formatDay(contributionDay)}`}
          testID="keypad-contribution"
        />
      </KeypadSheetFooter>

      <DatePickerModal
        visible={datePickerOpen}
        selectedDay={contributionDay}
        onSelectDay={setContributionDay}
        onClose={() => setDatePickerOpen(false)}
      />
    </BottomSheetModal>
  );
}
