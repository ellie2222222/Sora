import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Archive, Save } from 'lucide-react-native';
import { updateAccountSchema, type AccountDetailResponse } from '@sora/contracts';

import { Button, Input, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useUpdateAccountMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';

export interface AccountEditFormProps {
  /** Render with `key={account.id}` so a different account starts from its own values. */
  account: AccountDetailResponse;
  onArchive: () => void;
}

/** Name, and currency while the account is empty (§9.4); type and opening balance are fixed. */
export function AccountEditForm({ account, onArchive }: AccountEditFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [updateAccount, { isLoading: isSaving }] = useUpdateAccountMutation();
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState(account.currency);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // A hint only: an earmark contribution can still name the account, and the API has the final say.
  const canChangeCurrency = account.transactionCount === 0;
  const changes = {
    ...(name.trim() !== account.name ? { name } : {}),
    ...(currency !== account.currency ? { currency } : {}),
  };
  const isDirty = Object.keys(changes).length > 0;

  function edit(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setSaveError(null);
    };
  }

  async function handleSave() {
    setSaveError(null);
    const parsed = updateAccountSchema.safeParse(changes);
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    try {
      await updateAccount({ accountId: account.id, body: parsed.data }).unwrap();
      showToast(t('toast.accountUpdated'), 'success');
    } catch (error) {
      setSaveError(messageOf(error, t));
    }
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('accounts.editAccount')}
      </Text>
      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input
            testID="input-account-name"
            label={t('common.name')}
            value={name}
            onChangeText={edit(setName)}
            error={fieldErrors.name}
          />
        </View>
        {canChangeCurrency ? (
          <View style={{ width: theme.sizes.currencyField }}>
            <Input
              testID="input-account-currency"
              label={t('accounts.currency')}
              autoCapitalize="characters"
              maxLength={3}
              value={currency}
              onChangeText={edit((value) => setCurrency(value.toUpperCase()))}
              error={fieldErrors.currency}
            />
          </View>
        ) : null}
      </View>
      {!canChangeCurrency ? (
        <Text variant="caption" tone="muted">
          {t('accounts.currencyLocked')}
        </Text>
      ) : null}
      {saveError !== null ? <Text tone="danger">{saveError}</Text> : null}
      <Button
        testID="btn-submit-account"
        label={t('common.save')}
        icon={Save}
        onPress={() => void handleSave()}
        loading={isSaving}
        disabled={!isDirty || name.trim().length === 0}
        fullWidth
      />
      <Button testID="btn-archive-account" label={t('accounts.archiveAccount')} icon={Archive} variant="danger-outline" onPress={onArchive} fullWidth />
    </View>
  );
}
