import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, AccountType, accountTypeHasCard, accountTypeHasInstitution, createAccountSchema } from '@sora/contracts';

import {
  BottomSheetModal,
  Button,
  CalculatorKeypad,
  IconChip,
  Input,
  KeypadSheetFooter,
  Text,
  useCalculatorExpression,
} from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
import { useCreateAccountMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';
import { openingBalanceFor } from '../accountBalance.ts';
import { CardDetailsFields, type CardDetails } from './CardDetailsFields.tsx';

const NO_CARD_DETAILS: CardDetails = { institutionName: '', cardNetwork: null, cardLast4: '' };

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
  const { activeWallet, wallets } = useWallets();
  const walletId = propWalletId ?? activeWallet?.id;
  const defaultCurrency = wallets.find((wallet) => wallet.id === walletId)?.balances[0]?.currency ?? 'VND';
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();

  const { setExpression, expressionRef, display: displayAmount, confirm } = useCalculatorExpression('', '0');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(initialType ?? AccountType.BANK_ACCOUNT);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [details, setDetails] = useState<CardDetails>(NO_CARD_DETAILS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setExpression('');
      setName('');
      setType(initialType ?? AccountType.BANK_ACCOUNT);
      setCurrency(defaultCurrency);
      setDetails(NO_CARD_DETAILS);
      setFieldErrors({});
      setSubmitError(null);
    }
    // Keyed on the wallet's id, not its object: a refetch of the wallet list (any transaction, a sync,
    // coming back to the app) gives it a new identity and would wipe what the user is typing.
  }, [visible, walletId, initialType]);

  // Ref pattern (see CalculatorKeypadProps.onConfirmRef): keeps the keypad grid's identity stable.
  // Declared before the early returns so every render calls the same hooks.
  const onConfirmRef = useRef(handleConfirm);
  onConfirmRef.current = handleConfirm;

  if (!visible) return null;

  if (walletId === undefined) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title={t('accounts.addAccount')} entity="account">
        <View className="items-center justify-center" style={{ padding: theme.spacing.lg }}>
          <Text tone="muted">{t('accounts.noWalletSelected')}</Text>
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
      initialBalance: openingBalanceFor(type, initialBalance === '' ? '0' : initialBalance),
      // Only what this type may hold is sent: a detail typed before switching type is left behind, not refused.
      ...(accountTypeHasInstitution(type) && details.institutionName.trim() !== '' ? { institutionName: details.institutionName } : {}),
      ...(accountTypeHasCard(type) && details.cardNetwork !== null ? { cardNetwork: details.cardNetwork } : {}),
      ...(accountTypeHasCard(type) && details.cardLast4 !== '' ? { cardLast4: details.cardLast4 } : {}),
    });
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues, t));
      return;
    }

    setFieldErrors({});
    try {
      await createAccount(parsed.data).unwrap();
      onClose();
      showToast(t('toast.accountAdded'), 'success');
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
      ? t('accounts.openingBalanceCreditCard')
      : t('accounts.openingBalance');

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('accounts.addAccount')} closeLabel="cancel" entity="account">

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
        <CardDetailsFields type={type} value={details} onChange={setDetails} errors={fieldErrors} />
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
              accessibilityLabel={t('common.name')}
              placeholder={t('accounts.namePlaceholder')}
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
            />
          </View>
          <View style={{ width: theme.sizes.currencyField }}>
            <Input
              testID="picker-currency"
              accessibilityLabel={t('accounts.currency')}
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
