import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { createWalletSchema } from '@sora/contracts';

import { Button, Input, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useCreateWalletMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';

/** Resets whenever `active` turns true: the sheets hosting it stay mounted while hidden. */
export function CreateWalletForm({ active, onCreated }: { active: boolean; onCreated: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [createWallet, { isLoading: isCreating }] = useCreateWalletMutation();
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (active) {
      setName('');
      setFieldErrors({});
      setSubmitError(null);
    }
  }, [active]);

  async function handleCreate() {
    setSubmitError(null);
    const parsed = createWalletSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    try {
      await createWallet(parsed.data).unwrap();
      onCreated();
      showToast(t('toast.walletCreated', { defaultValue: 'Wallet created' }), 'success');
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Input
        testID="input-wallet-name"
        label={t('common.name')}
        placeholder={t('wallets.walletNamePlaceholder')}
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
      />
      {submitError !== null ? <Text tone="danger">{submitError}</Text> : null}
      <Button
        testID="btn-submit-wallet"
        label={t('common.create')}
        icon={Plus}
        onPress={handleCreate}
        loading={isCreating}
        disabled={name.trim().length === 0}
        fullWidth
      />
    </View>
  );
}
