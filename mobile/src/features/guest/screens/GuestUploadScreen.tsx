import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletResponse } from '@sora/contracts';

import { Button, Card, Input, StateView, Text } from '../../../components/index.ts';
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
import { Check, Loader2 } from 'lucide-react-native';

const UPLOAD_STEPS = [
  { key: 'categories', labelKey: 'guest.upload.stepCategories' },
  { key: 'accounts', labelKey: 'guest.upload.stepAccounts' },
  { key: 'transactions', labelKey: 'guest.upload.stepTransactions' },
  { key: 'budgets', labelKey: 'guest.upload.stepBudgets' },
  { key: 'goals', labelKey: 'guest.upload.stepGoals' },
  { key: 'archives', labelKey: 'guest.upload.stepArchives' },
] as const;

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
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());

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
    void resolveGuestUpload(targetWalletId, (phase, done) => {
      if (cancelled) return;
      if (done) {
        setCompletedPhases((prev) => new Set([...prev, phase]));
        setCurrentPhase(null);
      } else {
        setCurrentPhase(phase);
      }
    }).catch((error) => {
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
    return (
      <View
        testID="screen-guest-upload"
        style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}
      >
        <Text variant="heading">{t('guest.upload.title')}</Text>
        <Text tone="muted">{t('guest.upload.subtitle')}</Text>
        <StateView variant="error" testID="guest-upload-list-error" error={listError} retryAction={() => setListError(null)} />
      </View>
    );
  }

  if (uploadError !== null && targetWalletId !== null) {
    return (
      <View
        testID="screen-guest-upload"
        style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}
      >
        <Text variant="heading">{t('guest.upload.title')}</Text>
        <Text tone="muted">{t('guest.upload.subtitle')}</Text>
        <StateView
          variant="error"
          testID="guest-upload-error"
          error={uploadError}
          retryAction={() => {
            const walletId = targetWalletId;
            setUploadError(null);
            setTargetWalletId(null);
            // Re-trigger the upload effect on the same wallet on the next tick.
            setTimeout(() => setTargetWalletId(walletId), 0);
          }}
        />
      </View>
    );
  }

  if (wallets === null || targetWalletId !== null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg, backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="title">
          {targetWalletId !== null
            ? t('guest.upload.uploading')
            : t('common.loading')}
        </Text>
        {targetWalletId !== null ? (
          <Card elevated style={{ width: '100%', gap: theme.spacing.sm }}>
            {UPLOAD_STEPS.map((step) => {
              const isDone = completedPhases.has(step.key);
              const isCurrent = currentPhase === step.key;
              return (
                <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, opacity: isDone || isCurrent ? 1 : 0.4 }}>
                  <View style={{ width: 20, alignItems: 'center' }}>
                    {isDone ? (
                      <Check size={16} color={theme.colors.success} />
                    ) : isCurrent ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textFaint }} />
                    )}
                  </View>
                  <Text weight={isCurrent ? 'semibold' : 'regular'} tone={isDone ? 'success' : isCurrent ? 'default' : 'muted'}>

                    {t(step.labelKey)}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : null}
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
              <Text weight="semibold">{wallet.name === 'Guest Wallet' ? t('wallets.guestWallet') : wallet.name}</Text>
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
