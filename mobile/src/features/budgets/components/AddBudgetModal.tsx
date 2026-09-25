import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react-native';
import { BUDGET_PERIOD_TYPES, createBudgetSchema, type BudgetPeriodType } from '@sora/contracts';

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
// Deep-imported (not via the categories barrel): this component is itself deep-imported by
// ModalProvider, and pulling in `@/features/categories` here reintroduces a cycle through that
// barrel's other exports (same reasoning as AddTransactionModal.tsx's identical comment).
import { CategoryGrid } from '../../categories/components/CategoryGrid.tsx';
import { useCreateBudgetMutation } from '@/app/store';
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
  type CalendarDay,
} from '@/utils';

/**
 * The end a period type suggests for a start date — a convenience default, not a constraint:
 * FR-38 treats period type as a descriptive label only, the actual window is whatever start/end
 * dates the user leaves in place or edits (BUD-US-01).
 */
function suggestedEnd(period: BudgetPeriodType, start: CalendarDay, currentEnd: CalendarDay): CalendarDay {
  switch (period) {
    case 'MONTHLY':
      return addDays(addMonths(start, 1), -1);
    case 'WEEKLY':
      return addDays(start, 6);
    case 'CUSTOM':
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
  const [createBudget, { isLoading: isCreating }] = useCreateBudgetMutation();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [startDate, setStartDate] = useState<CalendarDay>(() => startOfMonth(today()));
  const [endDate, setEndDate] = useState<CalendarDay>(() => endOfMonth(today()));
  // Once the user picks an end date directly, a new start or period stops overwriting it — the
  // period only pre-fills a sensible window, per FR-38.
  const [endTouched, setEndTouched] = useState(false);
  const [pickingDate, setPickingDate] = useState<PickingDate>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const walletId = activeWallet?.id;

  useEffect(() => {
    if (visible) {
      setExpression('');
      setName('');
      setCategoryId(null);
      setPeriodType('MONTHLY');
      setStartDate(startOfMonth(today()));
      setEndDate(endOfMonth(today()));
      setEndTouched(false);
      setPickingDate(null);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible]);

  const PERIOD_LABEL: Record<BudgetPeriodType, string> = {
    WEEKLY: t('budgets.weekly', { defaultValue: 'Weekly' }),
    MONTHLY: t('budgets.monthly', { defaultValue: 'Monthly' }),
    CUSTOM: t('budgets.custom', { defaultValue: 'Custom' }),
  };

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef): keeps the keypad grid's identity stable.
  // Declared before the early returns so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => setPickingDate('start');

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
    if (!endTouched) setEndDate(suggestedEnd(next, startDate, endDate));
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
    if (categoryId === null) {
      setFieldErrors({ categoryId: t('budgets.chooseCategoryFirst', { defaultValue: 'Choose a category first.' }) });
      return;
    }

    const parsed = createBudgetSchema.safeParse({
      walletId,
      categoryId,
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

  const windowLabel = `${formatShortDay(startDate)} – ${formatShortDay(endDate)}`;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <SheetFormHeader title={t('budgets.newBudget')} onCancel={onClose} entity="budget" />

      <View className="flex-row" style={{ flexShrink: 0, gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        {BUDGET_PERIOD_TYPES.map((candidate) => (
          <Button
            key={candidate}
            testID={`btn-budget-period-${candidate}`}
            label={PERIOD_LABEL[candidate]}
            variant={periodType === candidate ? 'primary' : 'secondary'}
            onPress={() => handlePeriodTypeChange(candidate)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      <SheetScrollArea>
          <CategoryGrid
            testID="picker-category"
            walletId={walletId}
            type="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
            error={fieldErrors.categoryId}
          />
      </SheetScrollArea>

      <KeypadSheetFooter
        leading={
          <IconChip
            icon={CalendarRange}
            label={windowLabel}
            onPress={() => setPickingDate('end')}
            accessibilityLabel={`${t('budgets.endDate', { defaultValue: 'End date' })}, ${formatDay(endDate)}`}
            error={fieldErrors.endDate !== undefined}
            testID="input-budget-end-date"
          />
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
          onQuickDateRef={onQuickDateRef}
          dateLabel={formatShortDay(startDate)}
          dateAccessibilityLabel={`${t('budgets.startDate', { defaultValue: 'Start date' })}, ${formatDay(startDate)}`}
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
