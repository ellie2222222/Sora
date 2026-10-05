import { useEffect, useRef, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react-native';
import { BUDGET_PERIOD_TYPES, BudgetPeriodType, createBudgetSchema } from '@sora/contracts';

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
  StateView,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
// Deep-imported, not via `@/features/categories`: ModalProvider deep-imports this modal, and that
// barrel's other exports would close a cycle (same reasoning as AddTransactionModal.tsx).
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import { useCreateBudgetMutation, useListGoalsQuery } from '@/app/store';
import {
  addDays,
  addMonths,
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

function suggestedEnd(period: BudgetPeriodType, start: CalendarDay, currentEnd: CalendarDay): CalendarDay {
  switch (period) {
    case BudgetPeriodType.DAILY:
      return start;
    case BudgetPeriodType.MONTHLY:
      return addDays(addMonths(start, 1), -1);
    case BudgetPeriodType.WEEKLY:
      return addDays(start, 6);
    case BudgetPeriodType.YEARLY:
      return `${parseDay(start).year}-12-31`;
    case BudgetPeriodType.CUSTOM:
    case BudgetPeriodType.GOAL:
    default:
      return currentEnd < start ? start : currentEnd;
  }
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
  const { activeWallet } = useWallets();
  const walletId = activeWallet?.id;
  const [createBudget, { isLoading: isCreating }] = useCreateBudgetMutation();
  const { data: goals = [], isLoading: isLoadingGoals, isError: isErrorGoals } = useListGoalsQuery({ walletId: walletId ?? '' }, { skip: !visible || walletId === undefined });

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(BudgetPeriodType.MONTHLY);
  const [startDate, setStartDate] = useState<CalendarDay>(() => startOfMonth(today()));
  const [endDate, setEndDate] = useState<CalendarDay>(() => endOfMonth(today()));
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
      setStartDate(startOfMonth(today()));
      setEndDate(endOfMonth(today()));
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
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Select a wallet first')} testID="add-budget-unselected" />
      </BottomSheetModal>
    );
  }

  function handlePeriodTypeChange(next: BudgetPeriodType) {
    setPeriodType(next);
    const tday = today();
    if (next === BudgetPeriodType.DAILY) {
      setStartDate(tday);
      setEndDate(tday);
    } else if (next === BudgetPeriodType.MONTHLY) {
      setStartDate(startOfMonth(tday));
      setEndDate(endOfMonth(tday));
    } else if (next === BudgetPeriodType.YEARLY) {
      const year = parseDay(tday).year;
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else {
      if (!endTouched) setEndDate(suggestedEnd(next, startDate, endDate));
    }
  }

  function handleSelectDay(day: CalendarDay) {
    if (pickingDate === 'start') {
      setStartDate(day);
      setEndDate(endTouched ? endDate : suggestedEnd(periodType, day, endDate));
    } else if (pickingDate === 'end') {
      setEndDate(day);
      setEndTouched(true);
    }
  }

  async function handleSubmit(amount: string) {
    setSubmitError(null);
    if (walletId === undefined) return;

    if (periodType === BudgetPeriodType.GOAL && goalId === null) {
      setFieldErrors({ goalId: t('budgets.chooseGoalFirst', { defaultValue: 'Choose a goal first.' }) });
      return;
    }
    if (periodType !== BudgetPeriodType.GOAL && categoryId === null) {
      setFieldErrors({ categoryId: t('budgets.chooseCategoryFirst', { defaultValue: 'Choose a category first.' }) });
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
      endDate,
    });
    if (!parsed.success) {
      const next = issueMessagesByPath(parsed.error.issues);
      if (next.endDate !== undefined) {
        next.endDate = t('budgets.endBeforeStartError', { defaultValue: 'End date cannot be before start date.' });
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

  const windowLabel = `${formatShortDay(startDate)} \u2014 ${formatShortDay(endDate)}`;
  const shouldAllowManualDates = periodType === BudgetPeriodType.CUSTOM || periodType === BudgetPeriodType.GOAL || periodType === BudgetPeriodType.WEEKLY;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <SheetFormHeader title={t('budgets.newBudget')} onCancel={onClose} entity="budget" />

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
              <Text tone="muted">{t('common.loading', { defaultValue: 'Loading...' })}</Text>
            ) : isErrorGoals ? (
              <Text tone="danger">{t('common.error', { defaultValue: 'Error loading goals' })}</Text>
            ) : goals.length === 0 ? (
              <Text tone="muted">{t('goals.noGoals', { defaultValue: 'No goals found.' })}</Text>
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
          shouldAllowManualDates ? (
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
          placeholder={t('budgets.namePlaceholder', 'e.g. Food August')}
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
        selectedDay={pickingDate === 'end' ? endDate : startDate}
        onSelectDay={handleSelectDay}
        onClose={() => setPickingDate(null)}
      />
    </BottomSheetModal>
  );
}
