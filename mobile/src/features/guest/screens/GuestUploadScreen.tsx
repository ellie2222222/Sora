import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletResponse } from '@sora/contracts';

import { Button, Card, ErrorState, Input, Text } from '../../../components/index.ts';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { walletsApi } from '../../../services/api/wallets.ts';
import { messageOf } from '../../../utils/errors.ts';

/**
 * Rendered by `RootNavigator` whenever `pendingGuestUpload` is true: a real
 * login/register landed while local guest data still exists. Auto-selects
 * and uploads immediately when there is exactly one own wallet to land in;
 * otherwise the caller picks an existing one or creates a fresh one.
 *
 * `resolveGuestUpload` is safe to call again on failure — `guestUpload.ts`
 * skips whatever its persisted progress map already covers, so retrying
 * after a partial failure never re-uploads or double-records anything.
 */
export function GuestUploadScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { resolveGuestUpload } = useAuth();

  const [wallets, setWallets] = useState<WalletResponse[] | null>(null);
  const [listError, setListError] = useState<unknown>(null);
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [newWalletName, setNewWalletName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await walletsApi.list({ status: 'ACTIVE' });
        if (cancelled) return;
        const own = all.filter((wallet) => wallet.isOwn);
        setWallets(own);
        if (own.length === 1) setTargetWalletId(own[0]!.id);
      } catch (error) {
        if (!cancelled) setListError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (targetWalletId === null) return;
    let cancelled = false;
    setUploadError(null);
    void resolveGuestUpload(targetWalletId).catch((error) => {
      if (!cancelled) setUploadError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [targetWalletId, resolveGuestUpload]);

  async function handleCreateWallet() {
    setCreating(true);
    setListError(null);
    try {
      const created = await walletsApi.create({ name: newWalletName.trim() });
      setTargetWalletId(created.id);
    } catch (error) {
      setListError(error);
    } finally {
      setCreating(false);
    }
  }

  if (listError !== null) {
    return <ErrorState testID="guest-upload-list-error" error={listError} onRetry={() => setListError(null)} />;
  }

  if (uploadError !== null && targetWalletId !== null) {
    return (
      <ErrorState
        testID="guest-upload-error"
        error={uploadError}
        onRetry={() => {
          const walletId = targetWalletId;
          setUploadError(null);
          setTargetWalletId(null);
          // Re-trigger the upload effect on the same wallet on the next tick.
          setTimeout(() => setTargetWalletId(walletId), 0);
        }}
      />
    );
  }

  if (wallets === null || targetWalletId !== null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text tone="muted">
          {targetWalletId !== null
            ? t('guest.upload.uploading')
            : t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID="screen-guest-upload"
      style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}
    >
      <Text variant="heading">{t('guest.upload.title')}</Text>
      <Text tone="muted">{t('guest.upload.subtitle')}</Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{t('guest.upload.chooseWallet')}</Text>
        {wallets.map((wallet) => (
          <Card key={wallet.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text weight="semibold">{wallet.name}</Text>
              <Button
                testID={`guest-upload-use-${wallet.id}`}
                label={t('guest.upload.useThisWallet')}
                size="sm"
                onPress={() => setTargetWalletId(wallet.id)}
              />
            </View>
          </Card>
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="title">{t('guest.upload.createNew')}</Text>
        <Input
          testID="guest-upload-new-wallet-name"
          placeholder={t('guest.upload.newWalletPlaceholder')}
          value={newWalletName}
          onChangeText={setNewWalletName}
        />
        <Button
          testID="guest-upload-create-and-use"
          label={t('guest.upload.createAndUse')}
          onPress={() => void handleCreateWallet()}
          loading={creating}
          disabled={newWalletName.trim().length === 0}
          fullWidth
        />
      </View>
    </View>
  );
}
