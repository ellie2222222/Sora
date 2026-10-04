import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react-native';
import { updateWalletSchema, type WalletResponse } from '@sora/contracts';

import { Button, Card, Input, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useUpdateWalletMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';

export interface WalletEditCardProps {
  /** Render with `key={wallet.id}` so a different wallet starts from its own name. */
  wallet: WalletResponse;
}

/** Rename only; archive and restore stay with the wallet actions below it. */
export function WalletEditCard({ wallet }: WalletEditCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [updateWallet, { isLoading: isSaving }] = useUpdateWalletMutation();
  const [name, setName] = useState(wallet.name);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaveError(null);
    const parsed = updateWalletSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(issueMessagesByPath(parsed.error.issues).name);
      return;
    }
    setFieldError(undefined);
    try {
      await updateWallet({ walletId: wallet.id, body: parsed.data }).unwrap();
      showToast(t('toast.walletUpdated'), 'success');
    } catch (error) {
      setSaveError(messageOf(error, t));
    }
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('wallets.editWallet')}
      </Text>
      <Input
        testID="input-wallet-name"
        label={t('common.name')}
        value={name}
        onChangeText={(next) => {
          setName(next);
          setSaveError(null);
        }}
        error={fieldError}
      />
      {saveError !== null ? <Text tone="danger">{saveError}</Text> : null}
      <Button
        testID="btn-submit-wallet"
        label={t('common.save')}
        icon={Save}
        onPress={() => void handleSave()}
        loading={isSaving}
        disabled={name.trim() === wallet.name || name.trim().length === 0}
        fullWidth
      />
    </Card>
  );
}
