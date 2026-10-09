import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus } from 'lucide-react-native';
import { WalletStatus, type WalletResponse } from '@sora/contracts';

import { Button, Card, Input, StateView, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { walletsApi } from '@/services/api';
import { GUEST_WALLET_NAME, guestStore, guestUploadTask } from '@/services/guest';
import { deviceTimeZone } from '@/utils';
import { UploadProgressPanel } from '../components/UploadProgressPanel.tsx';
import { useGuestUploadTask, useGuestUploadView } from '../useGuestUpload.ts';

/**
 * Rendered by `RootNavigator` whenever `pendingGuestUpload` is true: a real
 * login/register landed while local guest data still exists. Auto-selects
 * and uploads immediately when there is exactly one own wallet to land in;
 * otherwise the caller picks an existing one or creates a fresh one.
 *
 * The upload itself runs on `guestUploadTask`, not here: "Continue in
 * background" closes this screen and the run carries on, and Cancel stops it
 * before its next request. Resuming is always safe — `guestUpload.ts` skips
 * whatever its persisted progress map already covers.
 */
export function GuestUploadScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { startGuestUpload } = useAuth();
  const task = useGuestUploadTask();
  const view = useGuestUploadView(task.status === 'done');

  // An upload stopped in an earlier launch: offered for resuming rather than restarted on its own.
  const [savedTarget] = useState(() => guestStore.current().uploadProgress?.walletId ?? null);
  const [wallets, setWallets] = useState<WalletResponse[] | null>(null);
  const [listError, setListError] = useState<unknown>(null);
  const [listAttempt, setListAttempt] = useState(0);
  const [newWalletName, setNewWalletName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await walletsApi.list({ status: WalletStatus.ACTIVE });
        if (cancelled) return;
        const own = all.filter((wallet) => wallet.isOwn);
        setWallets(own);
        const idle = guestUploadTask.current().status === 'idle';
        const hasSavedTarget = savedTarget !== null && own.some((wallet) => wallet.id === savedTarget);
        if (idle && !hasSavedTarget && own.length === 1) startGuestUpload(own[0]!.id);
      } catch (error) {
        if (!cancelled) setListError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listAttempt]);

  async function handleCreateWallet() {
    setCreating(true);
    setListError(null);
    try {
      const created = await walletsApi.create({ name: newWalletName.trim(), timeZone: deviceTimeZone() });
      startGuestUpload(created.id);
    } catch (error) {
      setListError(error);
    } finally {
      setCreating(false);
    }
  }

  const resumable = task.status === 'idle' && wallets?.some((wallet) => wallet.id === savedTarget);
  const targetWalletId = task.walletId ?? (resumable ? savedTarget : null);
  const targetName = wallets?.find((wallet) => wallet.id === targetWalletId)?.name;
  const walletName = targetName === undefined || targetName === GUEST_WALLET_NAME ? t('wallets.yourWallet') : targetName;

  if (task.status !== 'idle' || resumable) {
    return (
      <UploadProgressPanel
        status={task.status === 'idle' ? 'stopped' : task.status}
        error={task.error}
        walletName={walletName}
        view={view}
        onBackground={() => guestUploadTask.setInBackground(true)}
        onCancel={() => guestUploadTask.cancel()}
        onResume={() => targetWalletId !== null && startGuestUpload(targetWalletId)}
        onLater={() => guestUploadTask.setInBackground(true)}
      />
    );
  }

  if (listError !== null) {
    return (
      <View
        testID="screen-guest-upload"
        className="flex-1"
        style={{ backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}
      >
        <Text variant="heading">{t('guest.upload.title')}</Text>
        <Text tone="muted">{t('guest.upload.subtitle')}</Text>
        <StateView
          variant="error"
          testID="guest-upload-list-error"
          error={listError}
          retryAction={() => {
            setListError(null);
            setListAttempt((attempt) => attempt + 1);
          }}
        />
      </View>
    );
  }

  if (wallets === null) {
    return (
      <View
        testID="screen-guest-upload"
        className="flex-1 items-center justify-center"
        style={{ padding: theme.spacing.xl, gap: theme.spacing.lg, backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="title">{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View
      testID="screen-guest-upload"
      className="flex-1"
      style={{ backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}
    >
      <Text variant="heading">{t('guest.upload.title')}</Text>
      <Text tone="muted">{t('guest.upload.subtitle')}</Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{t('guest.upload.chooseWallet')}</Text>
        {wallets.map((wallet) => (
          <Card key={wallet.id}>
            <View className="flex-row justify-between items-center">
              <Text weight="semibold">{wallet.name === GUEST_WALLET_NAME ? t('wallets.yourWallet') : wallet.name}</Text>
              <Button
                testID={`btn-use-wallet-${wallet.id}`}
                label={t('guest.upload.useThisWallet')}
                icon={ArrowRight}
                size="sm"
                onPress={() => startGuestUpload(wallet.id)}
              />
            </View>
          </Card>
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{t('guest.upload.createNew')}</Text>
        <Input
          testID="input-wallet-name"
          placeholder={t('guest.upload.newWalletPlaceholder')}
          value={newWalletName}
          onChangeText={setNewWalletName}
        />
        <Button
          testID="btn-submit-wallet"
          label={t('guest.upload.createAndUse')}
          icon={Plus}
          onPress={() => void handleCreateWallet()}
          loading={creating}
          disabled={newWalletName.trim().length === 0}
          fullWidth
        />
      </View>
    </View>
  );
}
