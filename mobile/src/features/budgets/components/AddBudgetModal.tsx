import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BUDGET_PERIOD_TYPES, type BudgetPeriodType } from '@sora/contracts';

import { BottomSheetModal, Button, DateField, Input, MoneyInput, StateView, Text } from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
// Deep-imported (not via the categories barrel): this component is itself deep-imported by
// ModalProvider, and pulling in `@/features/categories` here reintroduces a cycle through that
// barrel's other exports (same reasoning as AddTransactionModal.tsx's identical comment).
import { CategoryPicker } from '../../categories/components/CategoryPicker.tsx';
import { useCreateBudgetMutation } from '@/app/store';
import { messageOf, addDays, endOfMonth, startOfMonth, today, type CalendarDay } from '@/utils';

/**
 * A starting window for a newly-picked period type — a convenience default, not a constraint:
 * FR-38 treats period type as a descriptive label only, the actual window is whatever start/end
 * dates the user leaves in place or edits (BUD-US-01).
 */
function defaultWindowFor(period: BudgetPeriodType): { startDate: CalendarDay; endDate: CalendarDay } {
  switch (period) {
    case 'MONTHLY':
      return { startDate: startOfMonth(today()), endDate: endOfMonth(today()) };
    case 'WEEKLY':
      return { startDate: today(), endDate: addDays(today(), 6) };
    case 'CUSTOM':
    default:
      return { startDate: today(), endDate: today() };
  }
}

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

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [startDate, setStartDate] = useState<CalendarDay>(() => defaultWindowFor('MONTHLY').startDate);
  const [endDate, setEndDate] = useState<CalendarDay>(() => defaultWindowFor('MONTHLY').endDate);
  // Once the user edits either date directly, switching the period-type pill stops overwriting
  // their choice — the pill only pre-fills a sensible starting window, per FR-38.
  const [datesTouched, setDatesTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletId = activeWallet?.id;

  useEffect(() => {
    if (visible) {
      const initialWindow = defaultWindowFor('MONTHLY');
      setName('');
      setCategoryId(null);
      setAmount('');
      setPeriodType('MONTHLY');
      setStartDate(initialWindow.startDate);
      setEndDate(initialWindow.endDate);
      setDatesTouched(false);
      setError(null);
    }
  }, [visible]);

  function handlePeriodTypeChange(next: BudgetPeriodType) {
    setPeriodType(next);
    if (!datesTouched) {
      const window = defaultWindowFor(next);
      setStartDate(window.startDate);
      setEndDate(window.endDate);
    }
  }

  const PERIOD_LABEL: Record<BudgetPeriodType, string> = {
    WEEKLY: t('budgets.weekly', { defaultValue: 'Weekly' }),
    MONTHLY: t('budgets.monthly', { defaultValue: 'Monthly' }),
    CUSTOM: t('budgets.custom', { defaultValue: 'Custom' }),
  };

  if (!visible) return null;

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')}>
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Select a wallet first')} testID="add-budget-unselected" />
      </BottomSheetModal>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (categoryId === null) {
      setError(t('budgets.chooseCategoryFirst', { defaultValue: 'Choose a category first.' }));
      return;
    }
    if (walletId === undefined) return;
    if (endDate < startDate) {
      setError(t('budgets.endBeforeStartError', { defaultValue: 'End date cannot be before start date.' }));
      return;
    }

    try {
      await createBudget({
        walletId,
        categoryId,
        name: name.trim().length > 0 ? name : `${PERIOD_LABEL[periodType]} budget`,
        amount,
        currency: activeWallet?.balances[0]?.currency ?? 'VND',
        periodType,
        startDate,
        endDate,
      }).unwrap();
      onClose();
      showToast(t('toast.budgetCreated', { defaultValue: 'Budget created' }), 'success');
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('budgets.newBudget')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        <Input testID="add-budget-name" label={t('categories.name', { defaultValue: 'Name' })} placeholder={t('budgets.namePlaceholder', 'e.g. Food August')} value={name} onChangeText={setName} />

        <CategoryPicker
          testID="add-budget-category"
          walletId={walletId}
          type="EXPENSE"
          value={categoryId}
          onChange={setCategoryId}
        />

        <MoneyInput testID="add-budget-amount" label={t('transactions.amount', { defaultValue: 'Amount' })} value={amount} onChangeValue={setAmount} />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('budgets.period', { defaultValue: 'Period' })}
          </Text>
          <View className="flex-row" style={{ gap: theme.spacing.xs }}>
            {BUDGET_PERIOD_TYPES.map((candidate) => (
              <Button
                key={candidate}
                label={PERIOD_LABEL[candidate]}
                size="sm"
                variant={periodType === candidate ? 'primary' : 'secondary'}
                onPress={() => handlePeriodTypeChange(candidate)}
              />
            ))}
          </View>
        </View>

        <View className="flex-row" style={{ gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <DateField
              testID="add-budget-start-date"
              label={t('budgets.startDate', { defaultValue: 'Start date' })}
              value={startDate}
              onChange={(day) => {
                setStartDate(day);
                setDatesTouched(true);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              testID="add-budget-end-date"
              label={t('budgets.endDate', { defaultValue: 'End date' })}
              value={endDate}
              onChange={(day) => {
                setEndDate(day);
                setDatesTouched(true);
              }}
            />
          </View>
        </View>

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="add-budget-submit"
          label={t('common.create')}
          onPress={handleSubmit}
          loading={isCreating}
          fullWidth
        />
      </ScrollView>
    </BottomSheetModal>
  );
}
