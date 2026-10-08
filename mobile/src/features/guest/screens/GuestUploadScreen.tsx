import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { WalletStatus, type WalletResponse } from '@sora/contracts';

import { Button, Card, Input, StateView, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { walletsApi } from '@/services/api';
import { GUEST_WALLET_NAME, guestStore, guestUploadTask, UPLOAD_PHASES } from '@/services/guest';
import { deviceTimeZone, messageOf } from '@/utils';
import { SyncRing } from '../components/SyncRing.tsx';
import { UploadProgressBar } from '../components/UploadProgressBar.tsx';
import { UploadStepsCard, type UploadStepState } from '../components/UploadStepsCard.tsx';
import { useCountFormat, useGuestUploadTask, useGuestUploadView } from '../useGuestUpload.ts';

const DOT_DIM = 0.25;

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
      <UploadProgressView
        status={task.status === 'idle' ? 'stopped' : task.status}
        error={task.error}
        walletName={walletName}
        onResume={() => targetWalletId !== null && startGuestUpload(targetWalletId)}
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

function UploadProgressView({
  status,
  error,
  walletName,
  onResume,
}: {
  status: 'running' | 'stopping' | 'stopped' | 'failed' | 'done';
  error: unknown;
  walletName: string;
  onResume: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const view = useGuestUploadView(status === 'done');
  const formatCount = useCountFormat();
  const working = status === 'running' || status === 'stopping' || status === 'done';
  const percent = Math.floor(view.fraction * 100);

  const steps = useMemo(() => {
    const done = new Set(view.donePhases);
    const current = UPLOAD_PHASES.find((phase) => !done.has(phase));
    return UPLOAD_PHASES.map((phase) => {
      const state: UploadStepState = done.has(phase) ? 'done' : phase === current ? (working ? 'active' : 'halted') : 'queued';
      const { done: rows, total } = view.steps[phase];
      return { phase, state, count: `${formatCount(rows)} / ${formatCount(total)}` };
    });
  }, [view.donePhases, view.steps, working, formatCount]);

  const title = status === 'failed' ? t('guest.upload.failedTitle') : working ? t('guest.upload.uploading') : t('guest.upload.pausedTitle');

  return (
    <View testID="screen-guest-upload" className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingTop: insets.top + theme.spacing.huge,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: theme.spacing.xl,
          gap: theme.spacing.xl,
        }}
      >
        <SyncRing fraction={view.fraction} active={working} burstKey={view.donePhases.length} />

        <View style={{ alignItems: 'center', gap: theme.spacing.sm, alignSelf: 'stretch' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text variant="title" style={{ textAlign: 'center', flexShrink: 1 }} accessibilityRole="header">
              {title}
            </Text>
            {working ? <AnimatedEllipsis /> : null}
          </View>
          {status === 'stopped' || status === 'failed' ? (
            <Text tone="muted" style={{ textAlign: 'center', maxWidth: theme.sizes.readableWidth }}>
              {status === 'failed' ? `${messageOf(error, t)} ` : ''}
              {t('guest.upload.pausedBody', { done: formatCount(view.doneRows), total: formatCount(view.totalRows), wallet: walletName })}
            </Text>
          ) : null}
        </View>

        <View style={{ alignSelf: 'stretch', gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" tone="muted" numeric testID="guest-upload-steps-done">
              {t('guest.upload.stepsDone', { done: view.donePhases.length, total: UPLOAD_PHASES.length })}
            </Text>
            <Text variant="label" weight="semibold" numeric testID="guest-upload-percent">
              {t('guest.upload.percent', { percent })}
            </Text>
          </View>
          <UploadProgressBar fraction={view.fraction} active={working} thickness={theme.sizes.progressBar.sm} />
        </View>

        <UploadStepsCard steps={steps} haltedBecause={status === 'failed' ? 'failed' : 'paused'} />
      </ScrollView>

      <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.lg, gap: theme.spacing.sm }}>
        {working ? (
          <>
            <Button
              testID="btn-background-guest-upload"
              label={t('guest.upload.runInBackground')}
              onPress={() => guestUploadTask.setInBackground(true)}
              fullWidth
            />
            <Button
              testID="btn-cancel-guest-upload"
              label={t('common.cancel')}
              variant="outline"
              loading={status === 'stopping'}
              loadingLabel={t('guest.upload.stopping')}
              disabled={status !== 'running'}
              onPress={() => guestUploadTask.cancel()}
              fullWidth
            />
          </>
        ) : (
          <>
            <Button testID="btn-resume-guest-upload" label={t('guest.upload.resume')} onPress={onResume} fullWidth />
            <Button
              testID="btn-later-guest-upload"
              label={t('guest.upload.later')}
              variant="outline"
              onPress={() => guestUploadTask.setInBackground(true)}
              fullWidth
            />
            <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
              {t('guest.upload.laterHint')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function AnimatedEllipsis() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const cycle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    cycle.value = withRepeat(withTiming(4, { duration: 1600, easing: Easing.linear }), -1);
    return () => cancelAnimation(cycle);
  }, [reduceMotion]);

  if (reduceMotion) return <Text variant="title">…</Text>;
  return (
    <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((index) => (
        <EllipsisDot key={index} index={index} cycle={cycle} color={theme.colors.text} />
      ))}
    </View>
  );
}

function EllipsisDot({ index, cycle, color }: { index: number; cycle: SharedValue<number>; color: string }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({ opacity: interpolate(cycle.value, [index, index + 0.4], [DOT_DIM, 1], 'clamp') }));
  return (
    <Animated.Text style={[{ color, fontFamily: theme.fontFamily.semibold, fontSize: theme.fontSize.xl }, style]}>.</Animated.Text>
  );
}
