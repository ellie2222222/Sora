import { useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react-native';
import { BUDGET_PERIOD_TYPES, BudgetPeriodType, createBudgetSchema, isRepeatingBudgetPeriod } from '@sora/contracts';

import {
  BottomSheetModal,
  Button,
  CalculatorKeypad,
  DatePickerModal,
  IconChip,
  Input,
  KeypadSheetFooter,
  SheetScrollArea,
  StateView,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
// Deep-imported, not via `@/features/categories`: ModalProvider deep-imports this modal, and that
// barrel's other exports would close a cycle (same reasoning as TransactionFormModal.tsx).
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import { useCreateBudgetMutation, useListGoalsQuery } from '@/app/store';
import {
  endOfMonth,
  formatDay,
  formatShortDay,
  issueMessagesByPath,
  messageOf,
  startOfMonth,
  today,
  parseDay,
  type CalendarDay,
} from '@/utils';

/** A fixed window's end, moved along when the start passes it. */
function suggestedEnd(start: CalendarDay, currentEnd: CalendarDay): CalendarDay {
  return currentEnd < start ? start : currentEnd;
}

type PickingDate = 'start' | 'end' | null;

export interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddBudgetModal({ visible, onClose }: AddBudgetModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeWallet, timeZone } = useWallets();
  const walletId = activeWallet?.id;
  const [createBudget, { isLoading: isCreating }] = useCreateBudgetMutation();
  const { data: goals = [], isLoading: isLoadingGoals, isError: isErrorGoals } = useListGoalsQuery({ walletId: walletId ?? '' }, { skip: !visible || walletId === undefined });

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(BudgetPeriodType.MONTHLY);
  const [startDate, setStartDate] = useState<CalendarDay>(() => startOfMonth(today(timeZone)));
  const [endDate, setEndDate] = useState<CalendarDay>(() => endOfMonth(today(timeZone)));
  const [endTouched, setEndTouched] = useState(false);
  const [pickingDate, setPickingDate] = useState<PickingDate>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setExpression('');
      setName('');
      setCategoryId(null);
      setGoalId(null);
      setPeriodType(BudgetPeriodType.MONTHLY);
      setStartDate(startOfMonth(today(timeZone)));
      setEndDate(endOfMonth(today(timeZone)));
      setEndTouched(false);
      setPickingDate(null);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible]);

  const PERIOD_LABEL: Record<BudgetPeriodType, string> = {
    [BudgetPeriodType.DAILY]: t('budgets.daily', { defaultValue: 'Daily' }),
    [BudgetPeriodType.WEEKLY]: t('budgets.weekly', { defaultValue: 'Weekly' }),
    [BudgetPeriodType.MONTHLY]: t('budgets.monthly', { defaultValue: 'Monthly' }),
    [BudgetPeriodType.YEARLY]: t('budgets.yearly', { defaultValue: 'Yearly' }),
    [BudgetPeriodType.CUSTOM]: t('budgets.custom', { defaultValue: 'Custom' }),
    [BudgetPeriodType.GOAL]: t('budgets.goal', { defaultValue: 'Goal' }),
  };

  // A repeating budget runs from its start until deleted, so it only takes a start (API spec §12.2).
  const REPEATS_LABEL: Record<string, string> = {
    [BudgetPeriodType.DAILY]: t('budgets.repeatsDaily'),
    [BudgetPeriodType.WEEKLY]: t('budgets.repeatsWeekly', { day: formatShortDay(startDate) }),
    [BudgetPeriodType.MONTHLY]: t('budgets.repeatsMonthly'),
    [BudgetPeriodType.YEARLY]: t('budgets.repeatsYearly'),
  };
  const repeats = isRepeatingBudgetPeriod(periodType);

  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => {
    if (periodType === BudgetPeriodType.CUSTOM || periodType === BudgetPeriodType.GOAL) {
      setPickingDate('start');
    }
  };

  if (!visible) return null;

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')}>
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Pick a wallet first')} testID="add-budget-unselected" />
      </BottomSheetModal>
    );
  }

  function handlePeriodTypeChange(next: BudgetPeriodType) {
    setPeriodType(next);
    const tday = today(timeZone);
    if (next === BudgetPeriodType.DAILY || next === BudgetPeriodType.WEEKLY) {
      setStartDate(tday);
    } else if (next === BudgetPeriodType.MONTHLY) {
      setStartDate(startOfMonth(tday));
    } else if (next === BudgetPeriodType.YEARLY) {
      setStartDate(`${parseDay(tday).year}-01-01`);
    } else if (!endTouched) {
      setEndDate(suggestedEnd(startDate, endDate));
    }
  }

  function handleSelectDay(day: CalendarDay) {
    if (pickingDate === 'start') {
      setStartDate(day);
      setEndDate(endTouched ? endDate : suggestedEnd(day, endDate));
    } else if (pickingDate === 'end') {
      setEndDate(day);
      setEndTouched(true);
    }
  }

  async function handleSubmit(amount: string) {
    setSubmitError(null);
    if (walletId === undefined) return;

    if (periodType === BudgetPeriodType.GOAL && goalId === null) {
      setFieldErrors({ goalId: t('budgets.chooseGoalFirst', { defaultValue: 'Pick a goal first.' }) });
      return;
    }
    if (periodType !== BudgetPeriodType.GOAL && categoryId === null) {
      setFieldErrors({ categoryId: t('budgets.chooseCategoryFirst', { defaultValue: 'Pick a category first.' }) });
      return;
    }

    const parsed = createBudgetSchema.safeParse({
      walletId,
      categoryId: periodType !== BudgetPeriodType.GOAL ? categoryId : null,
      goalId: periodType === BudgetPeriodType.GOAL ? goalId : null,
      name: name.trim().length > 0 ? name : `${PERIOD_LABEL[periodType]} budget`,
      amount,
      currency: activeWallet?.balances[0]?.currency ?? 'VND',
      periodType,
      startDate,
      endDate: repeats ? null : endDate,
    });
    if (!parsed.success) {
      const next = issueMessagesByPath(parsed.error.issues);
      if (next.endDate !== undefined) {
        next.endDate = t('budgets.endBeforeStartError', { defaultValue: "The end date can't come before the start date." });
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    try {
      await createBudget(parsed.data).unwrap();
      onClose();
      showToast(t('toast.budgetCreated', { defaultValue: 'Budget created' }), 'success');
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  function handleConfirm() {
    const amount = confirm();
    if (amount !== null) void handleSubmit(amount);
  }

  const windowLabel = repeats ? REPEATS_LABEL[periodType]! : `${formatShortDay(startDate)} \u2014 ${formatShortDay(endDate)}`;
  const shouldAllowManualDates = periodType === BudgetPeriodType.CUSTOM || periodType === BudgetPeriodType.GOAL || periodType === BudgetPeriodType.WEEKLY;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')} closeLabel="cancel" entity="budget">

      <View style={{ flexShrink: 0, marginBottom: theme.spacing.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
          {BUDGET_PERIOD_TYPES.map((candidate) => (
            <Button
              key={candidate}
              testID={`btn-budget-period-${candidate}`}
              label={PERIOD_LABEL[candidate]}
              variant={periodType === candidate ? 'primary' : 'secondary'}
              onPress={() => handlePeriodTypeChange(candidate)}
            />
          ))}
        </ScrollView>
      </View>

      <SheetScrollArea>
        {periodType === BudgetPeriodType.GOAL ? (
          <View style={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }}>
            {isLoadingGoals ? (
              <Text tone="muted">{t('common.loading')}</Text>
            ) : isErrorGoals ? (
              <Text tone="danger">{t('goals.loadFailed')}</Text>
            ) : goals.length === 0 ? (
              <Text tone="muted">{t('goals.noGoals', { defaultValue: 'No goals yet.' })}</Text>
            ) : (
              goals.map((goal) => (
                <Pressable
                  key={goal.id}
                  onPress={() => setGoalId(goal.id)}
                  style={{
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    backgroundColor: goal.id === goalId ? theme.colors.primaryMuted : theme.colors.surface,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: goal.id === goalId ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  <Text weight={goal.id === goalId ? 'bold' : 'medium'}>{goal.name}</Text>
                </Pressable>
              ))
            )}
            {fieldErrors.goalId ? <Text tone="danger">{fieldErrors.goalId}</Text> : null}
          </View>
        ) : (
          <CategoryGrid
            testID="picker-category"
            walletId={walletId}
            type="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
            error={fieldErrors.categoryId}
          />
        )}
      </SheetScrollArea>

      <KeypadSheetFooter
        leading={
          !repeats ? (
            <IconChip
              icon={CalendarRange}
              label={windowLabel}
              onPress={() => setPickingDate('end')}
              accessibilityLabel={`${t('budgets.endDate', { defaultValue: 'End date' })}, ${formatDay(endDate)}`}
              error={fieldErrors.endDate !== undefined}
              testID="input-budget-end-date"
            />
          ) : (
            <View style={{ paddingHorizontal: theme.spacing.sm }}>
              <Text variant="caption" tone="muted">{windowLabel}</Text>
            </View>
          )
        }
        amount={displayAmount}
        amountTestID="add-budget-amount-display"
        errors={[fieldErrors.endDate, fieldErrors.amount]}
      >
        <Input
          testID="input-budget-name"
          placeholder={t('budgets.namePlaceholder', 'e.g. Food in August')}
          value={name}
          onChangeText={setName}
          error={fieldErrors.name}
        />

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          onConfirmRef={onConfirmRef}
          confirmDisabled={isCreating}
          onQuickDateRef={shouldAllowManualDates ? onQuickDateRef : undefined}
          dateLabel={shouldAllowManualDates ? formatShortDay(startDate) : undefined}
          dateAccessibilityLabel={shouldAllowManualDates ? `${t('budgets.startDate', { defaultValue: 'Start date' })}, ${formatDay(startDate)}` : undefined}
          testID="keypad-budget"
        />
      </KeypadSheetFooter>

      <DatePickerModal
        visible={pickingDate !== null}
        today={today(timeZone)}
        selectedDay={pickingDate === 'end' ? endDate : startDate}
        onSelectDay={handleSelectDay}
        onClose={() => setPickingDate(null)}
      />
    </BottomSheetModal>
  );
}
