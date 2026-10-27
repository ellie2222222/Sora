import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { createContributionSchema } from '@sora/contracts';

import { BottomSheetModal, CalculatorKeypad, DatePickerModal, Input, KeypadSheetFooter, SheetScrollArea, Skeleton, StateView, Text, ThemedIcon, ThemedView, useCalculatorExpression } from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
// Deep-imported, not via feature barrels: ModalProvider deep-imports this modal, and those barrels'
// other exports would close a require cycle (CLAUDE.md MB-10).
import { AccountPicker } from '../../accounts/components/AccountPicker.tsx';
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import { useAddContributionMutation, useGetGoalQuery } from '@/app/store';
import {
  formatDay,
  formatShortDay,
  middayOf,
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
  /** Returns to the goal sheet this was opened from. */
  onBack?: () => void;
  /** Closes the goal sheet too, from the header's Close. */
  onCloseAll?: () => void;
}

export function AddContributionModal({ visible, goalId, onClose, onBack, onCloseAll }: AddContributionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const goal = useGetGoalQuery(goalId ?? '', { skip: !visible || !goalId });
  const { wallets, timeZone: activeTimeZone } = useWallets();
  // The goal's own wallet decides the day, which this sheet may open from another wallet's view.
  const timeZone = wallets.find((wallet) => wallet.id === goal.data?.walletId)?.timeZone ?? activeTimeZone;
  const [addContribution, { isLoading: isSubmitting }] = useAddContributionMutation();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [contributionDay, setContributionDay] = useState<CalendarDay>(() => today(timeZone));
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
      setContributionDay(today(timeZone));
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
      <BottomSheetModal visible={visible} onClose={onClose} onBack={onBack} onCloseAll={onCloseAll} title={t('goals.addContribution')}>
                <View style={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>
          
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>
          
          <Skeleton width="100%" height={theme.sizes.skeletonBlock.lg} radius={theme.radius.md} />
        </View>
      </BottomSheetModal>
    );
  }

  if (goal.isError && (!isNetworkError(goal.error) || goal.data === undefined)) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} onBack={onBack} onCloseAll={onCloseAll} title={t('goals.addContribution')}>
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
      contributionDate: middayOf(contributionDay, timeZone),
      note: note.trim() || undefined,
      recordAsTransaction,
      categoryId: recordAsTransaction ? (categoryId ?? undefined) : undefined,
    });
    if (!parsed.success) {
      const next = issueMessagesByPath(parsed.error.issues, t);
      if (next.accountId !== undefined) {
        next.accountId = t('goals.chooseAccountError', { defaultValue: 'Pick the account this comes from.' });
      }
      if (next.amount !== undefined) {
        next.amount = t('goals.validAmountError', { defaultValue: 'Enter an amount above zero.' });
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
    <BottomSheetModal visible={visible} onClose={onClose} onBack={onBack} onCloseAll={onCloseAll} title={t('goals.addContribution')} closeLabel="cancel" entity="contribution">

      <SheetScrollArea>
        <Pressable
          testID="input-contribution-record-transaction"
          onPress={() => setRecordAsTransaction((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: recordAsTransaction }}
          className="flex-row items-center"
          style={{ gap: theme.spacing.sm }}
        >
          <ThemedView
            className="items-center justify-center"
            style={{
              width: theme.sizes.checkbox,
              height: theme.sizes.checkbox,
              borderWidth: theme.borderWidth.medium,
              borderRadius: theme.radius.sm,
              borderColor: recordAsTransaction ? theme.colors.primary : theme.colors.borderControl,
              backgroundColor: recordAsTransaction ? theme.colors.primary : 'transparent',
            }}
          >
            {recordAsTransaction ? <ThemedIcon icon={Check} size={theme.iconSize.sm} color={theme.colors.onPrimary} /> : null}
          </ThemedView>
          <View className="flex-1">
            <Text weight="medium">
              {t('goals.recordAsExpense', { defaultValue: 'Record as an expense' })}
            </Text>
            <Text variant="caption" tone="muted">
              {t('goals.recordAsExpenseHelp', {
                defaultValue:
                  'Takes the money out of the account now. Leave it off to just mark progress, without recording a transaction.',
              })}
            </Text>
          </View>
        </Pressable>

        {recordAsTransaction ? (
          <CategoryGrid
            testID="picker-category"
            walletId={goalData.walletId}
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
            // The account must be the goal's wallet's own (spec §13), so only those are offered.
            walletId={goalData.walletId}
            value={accountId}
            onChange={setAccountId}
          />
        }
        amount={displayAmount}
        amountTestID="add-contribution-amount-display"
        errors={[fieldErrors.accountId, fieldErrors.amount]}
      >
        <Input
          testID="input-contribution-note"
          placeholder={t('transactions.notePlaceholder', { defaultValue: 'Add a note' })}
          value={note}
          onChangeText={setNote}
          error={fieldErrors.note}
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
        today={today(timeZone)}
        selectedDay={contributionDay}
        onSelectDay={setContributionDay}
        onClose={() => setDatePickerOpen(false)}
      />
    </BottomSheetModal>
  );
}
