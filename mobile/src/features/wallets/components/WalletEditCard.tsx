import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react-native';
import { updateWalletSchema, type WalletResponse } from '@sora/contracts';

import { Button, Card, ConfirmDialog, Input, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useUpdateWalletMutation } from '@/app/store';
import { deviceTimeZone, issueMessagesByPath, messageOf } from '@/utils';
import { timeZoneLabel } from '../timeZones.ts';
import { TimeZoneField } from './TimeZoneField.tsx';

export interface WalletEditCardProps {
  /** Render with `key={wallet.id}` so a different wallet starts from its own name. */
  wallet: WalletResponse;
}

/** Name and calendar zone; archive and restore stay with the wallet actions below it. */
export function WalletEditCard({ wallet }: WalletEditCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [updateWallet, { isLoading: isSaving }] = useUpdateWalletMutation();
  const [name, setName] = useState(wallet.name);
  // A wallet cached before zones existed has none until it refetches.
  const savedTimeZone = wallet.timeZone ?? deviceTimeZone();
  const [timeZone, setTimeZone] = useState(savedTimeZone);
  const [confirmingZone, setConfirmingZone] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameChanged = name.trim() !== wallet.name;
  const zoneChanged = timeZone !== savedTimeZone;

  async function handleSave() {
    setSaveError(null);
    setConfirmingZone(false);
    const parsed = updateWalletSchema.safeParse({
      ...(nameChanged ? { name } : {}),
      ...(zoneChanged ? { timeZone } : {}),
    });
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
      <TimeZoneField
        value={timeZone}
        onChange={(next) => {
          setTimeZone(next);
          setSaveError(null);
        }}
      />
      {saveError !== null ? <Text tone="danger">{saveError}</Text> : null}
      <Button
        testID="btn-submit-wallet"
        label={t('common.save')}
        icon={Save}
        // Moving the zone re-files transactions near midnight and can change totals, so it is confirmed first.
        onPress={() => (zoneChanged ? setConfirmingZone(true) : void handleSave())}
        loading={isSaving}
        disabled={(!nameChanged && !zoneChanged) || name.trim().length === 0}
        fullWidth
      />
      <ConfirmDialog
        visible={confirmingZone}
        variant="warning"
        title={t('wallets.timeZoneChangeTitle')}
        message={t('wallets.timeZoneChangeBody', { zone: timeZoneLabel(timeZone) })}
        confirmLabel={t('wallets.timeZoneChangeConfirm')}
        loading={isSaving}
        onConfirm={() => void handleSave()}
        onCancel={() => setConfirmingZone(false)}
      />
    </Card>
  );
}
