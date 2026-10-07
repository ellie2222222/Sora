import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react-native';
import { createGoalSchema } from '@sora/contracts';

import {
  BottomSheetModal,
  CalculatorKeypad,
  DatePresetSheet,
  IconChip,
  Input,
  KeypadSheetFooter,
  StateView,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useToast, useWallets } from '@/app/providers';
import { useCreateGoalMutation } from '@/app/store';
import { formatDay, formatShortDay, issueMessagesByPath, messageOf, type CalendarDay } from '@/utils';
import { useGoalDeadlineSheet } from './useGoalDeadlineSheet.ts';

export interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddGoalModal({ visible, onClose }: AddGoalModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeWallet } = useWallets();
  const [createGoal, { isLoading: isCreating }] = useCreateGoalMutation();
  const deadlineSheet = useGoalDeadlineSheet();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState<CalendarDay | null>(null);
  const [deadlineSheetOpen, setDeadlineSheetOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setExpression('');
      setName('');
      setTargetDate(null);
      setDeadlineSheetOpen(false);
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible]);

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef): keeps the keypad grid's identity stable.
  // Declared before the early returns so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;
  const onQuickDateRef = useRef(() => {});
  onQuickDateRef.current = () => setDeadlineSheetOpen(true);

  if (!visible) return null;

  if (activeWallet === null) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.newGoal')}>
        <StateView variant="informational" title={t('wallets.selectWalletFirst', 'Pick a wallet first')} testID="add-goal-unselected" />
      </BottomSheetModal>
    );
  }

  async function handleSubmit(targetAmount: string) {
    setSubmitError(null);
    if (activeWallet === null) return;

    const parsed = createGoalSchema.safeParse({
      walletId: activeWallet.id,
      name,
      targetAmount,
      currency: activeWallet.balances[0]?.currency ?? 'VND',
      targetDate,
    });
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    try {
      await createGoal(parsed.data).unwrap();
      onClose();
      showToast(t('toast.goalCreated', { defaultValue: 'Goal created' }), 'success');
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  function handleConfirm() {
    const amount = confirm();
    if (amount !== null) void handleSubmit(amount);
  }

  const deadlineLabel = t('goals.deadline', { defaultValue: 'Deadline' });
  const targetDateText = targetDate !== null ? formatDay(targetDate) : t('goals.noTargetDate', { defaultValue: 'Not set' });

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('goals.newGoal')} closeLabel="cancel" entity="goal">

      <KeypadSheetFooter
        divider={false}
        leading={
          <IconChip
            icon={Flag}
            label={targetDateText}
            placeholder={targetDate === null}
            accessibilityLabel={`${deadlineLabel}, ${targetDateText}`}
            onPress={() => setDeadlineSheetOpen(true)}
            onClear={targetDate !== null ? () => setTargetDate(null) : undefined}
            clearAccessibilityLabel={t('common.clear')}
            testID="input-goal-target-date"
          />
        }
        amount={displayAmount}
        amountTestID="add-goal-amount-display"
        errors={[fieldErrors.targetAmount]}
      >
        <Input
          testID="input-goal-name"
          placeholder={t('goals.namePlaceholder', 'e.g. New laptop')}
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
          dateLabel={targetDate !== null ? formatShortDay(targetDate) : deadlineLabel}
          dateAccessibilityLabel={`${deadlineLabel}, ${targetDateText}`}
          testID="keypad-goal"
        />
      </KeypadSheetFooter>

      <DatePresetSheet
        {...deadlineSheet}
        visible={deadlineSheetOpen}
        value={targetDate}
        onSelect={setTargetDate}
        onClose={() => setDeadlineSheetOpen(false)}
      />
    </BottomSheetModal>
  );
}
