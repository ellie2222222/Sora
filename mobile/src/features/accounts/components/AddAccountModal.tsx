import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, AccountType, createAccountSchema } from '@sora/contracts';

import {
  BottomSheetModal,
  Button,
  CalculatorKeypad,
  IconChip,
  Input,
  KeypadSheetFooter,
  SheetFormHeader,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
import { useCreateAccountMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';

/** Two rows of two, so the longest type label still fits on one line in every locale. */
const TYPE_ROWS: AccountType[][] = [ACCOUNT_TYPES.slice(0, 2), ACCOUNT_TYPES.slice(2)];

export interface AddAccountModalProps {
  visible: boolean;
  walletId?: string;
  initialType?: AccountType;
  onClose: () => void;
}

export function AddAccountModal({ visible, walletId: propWalletId, initialType, onClose }: AddAccountModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeWallet } = useWallets();
  const walletId = propWalletId ?? activeWallet?.id;
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(initialType ?? AccountType.BANK_ACCOUNT);
  const [currency, setCurrency] = useState(activeWallet?.balances[0]?.currency ?? 'VND');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setExpression('');
      setName('');
      setType(initialType ?? AccountType.BANK_ACCOUNT);
      setCurrency(activeWallet?.balances[0]?.currency ?? 'VND');
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [visible, activeWallet, initialType]);

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef): keeps the keypad grid's identity stable.
  // Declared before the early returns so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;

  if (!visible) return null;

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('accounts.addAccount')}>
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted">{t('accounts.noWalletSelected', { defaultValue: 'No wallet selected.' })}</Text>
        </View>
      </BottomSheetModal>
    );
  }

  async function handleSubmit(initialBalance: string) {
    setSubmitError(null);
    if (walletId === undefined) return;

    const parsed = createAccountSchema.safeParse({
      walletId,
      name,
      type,
      currency,
      // A blank keypad means no opening balance, not an invalid one.
      initialBalance: initialBalance === '' ? '0' : initialBalance,
    });
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    try {
      await createAccount(parsed.data).unwrap();
      onClose();
      showToast(t('toast.accountAdded', { defaultValue: 'Account added' }), 'success');
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  function handleConfirm() {
    const amount = confirm();
    if (amount !== null) void handleSubmit(amount);
  }

  const balanceLabel =
    type === AccountType.CREDIT_CARD
      ? t('accounts.openingBalanceCreditCard', { defaultValue: 'Opening balance (negative if you owe)' })
      : t('accounts.openingBalance', { defaultValue: 'Opening balance' });

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <SheetFormHeader title={t('accounts.addAccount')} onCancel={onClose} entity="account" />

      <View style={{ flexShrink: 0, gap: theme.spacing.sm }}>
        {TYPE_ROWS.map((row) => (
          <View key={row.join()} className="flex-row" style={{ gap: theme.spacing.sm }}>
            {row.map((candidate) => (
              <Button
                key={candidate}
                testID={`btn-account-type-${candidate}`}
                label={t(ACCOUNT_TYPE_LABEL_KEY[candidate])}
                variant={type === candidate ? 'primary' : 'secondary'}
                onPress={() => setType(candidate)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        ))}
      </View>

      <KeypadSheetFooter
        leading={<IconChip icon={ACCOUNT_ICON[type]} label={balanceLabel} testID="add-account-balance-label" />}
        amount={displayAmount}
        amountTestID="add-account-initial-balance"
        errors={[fieldErrors.initialBalance]}
      >
        <View className="flex-row" style={{ gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              testID="input-account-name"
              placeholder={t('accounts.namePlaceholder', 'e.g. Vietcombank VND')}
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
            />
          </View>
          <View style={{ width: theme.sizes.currencyField }}>
            <Input
              testID="picker-currency"
              accessibilityLabel={t('accounts.currency', { defaultValue: 'Currency' })}
              autoCapitalize="characters"
              maxLength={3}
              value={currency}
              onChangeText={setCurrency}
              error={fieldErrors.currency}
            />
          </View>
        </View>

        {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}

        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          onConfirmRef={onConfirmRef}
          confirmDisabled={isCreating}
          testID="keypad-account"
        />
      </KeypadSheetFooter>
    </BottomSheetModal>
  );
}
