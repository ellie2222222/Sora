import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus } from 'lucide-react-native';
import { createWalletSchema, WalletStatus, type WalletResponse } from '@sora/contracts';

import { Button, Card, Input, SkeletonList, StateView, Text, ThemedView } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { walletsApi } from '@/services/api';
import { GUEST_WALLET_NAME, guestStore, guestUploadTask } from '@/services/guest';
import { deviceTimeZone, fieldErrorMessage, messageOf } from '@/utils';
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
  const insets = useSafeAreaInsets();
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<unknown>(null);

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
    setCreateError(null);
    const parsed = createWalletSchema.safeParse({ name: newWalletName, timeZone: deviceTimeZone() });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((candidate) => candidate.path[0] === 'name') ?? parsed.error.issues[0]!;
      setNameError(fieldErrorMessage(issue, t));
      return;
    }
    setNameError(null);
    setCreating(true);
    try {
      const created = await walletsApi.create(parsed.data);
      startGuestUpload(created.id);
    } catch (error) {
      setCreateError(error);
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

  const shellStyle = {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    paddingTop: insets.top + theme.spacing.xl,
    gap: theme.spacing.lg,
  };
  const header = (
    <>
      <Text variant="heading">{t('guest.upload.title')}</Text>
      <Text tone="muted">{t('guest.upload.subtitle')}</Text>
    </>
  );

  if (listError !== null) {
    return (
      <ThemedView testID="screen-guest-upload" className="flex-1" style={shellStyle}>
        {header}
        <StateView
          variant="error"
          testID="guest-upload-list-error"
          error={listError}
          retryAction={() => {
            setListError(null);
            setListAttempt((attempt) => attempt + 1);
          }}
        />
      </ThemedView>
    );
  }

  if (wallets === null) {
    return (
      <ThemedView testID="screen-guest-upload" className="flex-1" style={shellStyle} accessibilityLabel={t('common.loading')}>
        {header}
        <SkeletonList rows={2} />
      </ThemedView>
    );
  }

  return (
    <ThemedView testID="screen-guest-upload" className="flex-1" style={shellStyle}>
      {header}

      {wallets.length > 0 ? (
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
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{t('guest.upload.createNew')}</Text>
        <Input
          testID="input-wallet-name"
          label={t('common.name')}
          placeholder={t('guest.upload.newWalletPlaceholder')}
          value={newWalletName}
          onChangeText={(name) => {
            setNewWalletName(name);
            setNameError(null);
          }}
          error={nameError ?? undefined}
        />
        <Button
          testID="btn-submit-wallet"
          label={t('guest.upload.createAndUse')}
          icon={Plus}
          onPress={() => void handleCreateWallet()}
          loading={creating}
          fullWidth
        />
        {createError !== null ? (
          <Text tone="danger" testID="guest-upload-create-error">
            {messageOf(createError, t)}
          </Text>
        ) : null}
      </View>
    </ThemedView>
  );
}
