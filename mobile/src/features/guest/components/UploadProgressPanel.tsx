import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

import { Button, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { UPLOAD_PHASES, type GuestUploadStatus } from '@/services/guest';
import { messageOf } from '@/utils';
import { useCountFormat, type GuestUploadView } from '../useGuestUpload.ts';
import { SyncRing } from './SyncRing.tsx';
import { UploadProgressBar } from './UploadProgressBar.tsx';
import { UploadStepsCard, type UploadStepState } from './UploadStepsCard.tsx';

const DOT_DIM = 0.25;

export type UploadPanelStatus = Exclude<GuestUploadStatus, 'idle'>;

interface UploadProgressPanelProps {
  status: UploadPanelStatus;
  error: unknown;
  walletName: string;
  view: GuestUploadView;
  onBackground: () => void;
  onCancel: () => void;
  onResume: () => void;
  onLater: () => void;
}

/** What the upload screen shows for a run or a paused upload; the caller owns the run, so a preview can drive it too. */
export function UploadProgressPanel({ status, error, walletName, view, onBackground, onCancel, onResume, onLater }: UploadProgressPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
          {status === 'failed' ? (
            <Text testID="guest-upload-error" weight="semibold" style={{ textAlign: 'center', color: theme.colors.warning }}>
              {messageOf(error, t)}
            </Text>
          ) : null}
          {status === 'stopped' || status === 'failed' ? (
            <Text tone="muted" style={{ textAlign: 'center', maxWidth: theme.sizes.readableWidth }}>
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
            <Button testID="btn-background-guest-upload" label={t('guest.upload.runInBackground')} onPress={onBackground} fullWidth />
            <Button
              testID="btn-cancel-guest-upload"
              label={t('common.cancel')}
              variant="outline"
              loading={status === 'stopping'}
              loadingLabel={t('guest.upload.stopping')}
              disabled={status !== 'running'}
              onPress={onCancel}
              fullWidth
            />
          </>
        ) : (
          <>
            <Button testID="btn-resume-guest-upload" label={t('guest.upload.resume')} onPress={onResume} fullWidth />
            <Button testID="btn-later-guest-upload" label={t('guest.upload.later')} variant="outline" onPress={onLater} fullWidth />
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
