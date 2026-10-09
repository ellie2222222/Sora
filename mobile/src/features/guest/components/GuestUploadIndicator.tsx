import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { guestUploadTask, type GuestUploadStatus } from '@/services/guest';
import { useGuestUploadTask, useGuestUploadView } from '../useGuestUpload.ts';
import { UploadProgressBar } from './UploadProgressBar.tsx';

/**
 * Kept mounted by `RootNavigator`, not only while `visible`, so it can confirm an upload that
 * finished in the foreground too (the upload screen unmounts the moment it does).
 */
export function GuestUploadIndicator({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const task = useGuestUploadTask();
  const view = useGuestUploadView(task.status === 'done');

  useEffect(() => {
    if (task.status !== 'done') return;
    showToast(t('guest.upload.done'));
    guestUploadTask.reset();
  }, [task.status, showToast, t]);

  if (!visible) return null;
  return <UploadPill status={task.status} fraction={view.fraction} onPress={() => guestUploadTask.setInBackground(false)} />;
}

/** The pill itself, for the real upload or a preview. */
export function UploadPill({ status, fraction, onPress }: { status: GuestUploadStatus; fraction: number; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);

  const percent = Math.floor(fraction * 100);
  const label =
    status === 'running'
      ? t('guest.upload.indicatorRunning', { percent })
      : status === 'stopping'
        ? t('guest.upload.indicatorStopping')
        : status === 'failed'
          ? t('guest.upload.indicatorFailed')
          : t('guest.upload.indicatorPaused');

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + theme.spacing.xs, left: 0, right: 0, alignItems: 'center' }}>
      <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable
          testID="guest-upload-indicator"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('guest.upload.indicatorHint')}
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            width: theme.sizes.readableWidth,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.xs,
            borderRadius: theme.radius.xl,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.borderStrong,
            backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surfaceElevated,
            ...theme.shadows.md,
          }}
        >
          <Text
            variant="label"
            numeric
            numberOfLines={1}
            style={{ textAlign: 'center', color: status === 'failed' ? theme.colors.warning : theme.colors.text }}
          >
            {label}
          </Text>
          <UploadProgressBar fraction={fraction} active={status === 'running'} thickness={theme.borderWidth.thick} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
