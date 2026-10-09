import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TriangleAlert, X } from 'lucide-react-native';

import { Button, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { NO_ROWS_UPLOADED, advance, isFinished, simulatedView } from '../uploadPreviewSimulation.ts';
import { UploadPill } from './GuestUploadIndicator.tsx';
import { UploadProgressPanel, type UploadPanelStatus } from './UploadProgressPanel.tsx';

const TICK_MS = 80;
/** How long Cancel waits for the "request in flight", as the real run finishes its current request first. */
const STOPPING_MS = 700;
/** Lets the finished screen show for a moment before it closes, as the real gate does once the store clears. */
const FINISH_MS = 600;
/** Shaped like a transport failure, so the panel shows the app's own no-connection message. */
const SIMULATED_FAILURE = { status: 0 };

/**
 * A development-only run of the real upload screen and pill on simulated progress: no account, no
 * server and no guest data, so the design can be tried any time from Settings.
 */
export function UploadPreview({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* A Modal is a separate native window, so it measures its own insets. */}
      <SafeAreaProvider>{visible ? <SimulatedUpload onClose={onClose} /> : null}</SafeAreaProvider>
    </Modal>
  );
}

function SimulatedUpload({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState(NO_ROWS_UPLOADED);
  const [status, setStatus] = useState<UploadPanelStatus>('running');
  const [error, setError] = useState<unknown>(null);
  const [inBackground, setInBackground] = useState(false);
  const failNextTick = useRef(false);
  const view = useMemo(() => simulatedView(counts), [counts]);

  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => {
      if (failNextTick.current) {
        failNextTick.current = false;
        setError(SIMULATED_FAILURE);
        setStatus('failed');
        return;
      }
      setCounts(advance);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'running' && isFinished(counts)) setStatus('done');
  }, [status, counts]);

  useEffect(() => {
    if (status === 'stopping') {
      const timer = setTimeout(() => setStatus('stopped'), STOPPING_MS);
      return () => clearTimeout(timer);
    }
    if (status === 'done') {
      const timer = setTimeout(() => {
        showToast(t('guest.upload.done'));
        onClose();
      }, FINISH_MS);
      return () => clearTimeout(timer);
    }
  }, [status, showToast, t, onClose]);

  function resume() {
    setError(null);
    setStatus('running');
  }

  if (inBackground) {
    return (
      <View testID="screen-guest-upload-preview-background" className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <Text tone="muted" style={{ textAlign: 'center', maxWidth: theme.sizes.readableWidth }}>
          {t('guest.upload.preview.backgroundHint')}
        </Text>
        <Button testID="btn-close-upload-preview" label={t('guest.upload.preview.close')} icon={X} variant="outline" onPress={onClose} fullWidth />
        <UploadPill status={status} fraction={view.fraction} onPress={() => setInBackground(false)} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <UploadProgressPanel
        status={status}
        error={error}
        walletName={t('wallets.yourWallet')}
        view={view}
        onBackground={() => setInBackground(true)}
        onCancel={() => setStatus('stopping')}
        onResume={resume}
        onLater={() => setInBackground(true)}
      />
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + theme.spacing.xs, left: theme.spacing.md, right: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Button testID="btn-close-upload-preview" label={t('guest.upload.preview.close')} icon={X} variant="ghost" size="sm" onPress={onClose} />
        <Button
          testID="btn-fail-upload-preview"
          label={t('guest.upload.preview.simulateFailure')}
          icon={TriangleAlert}
          variant="ghost"
          size="sm"
          disabled={status !== 'running'}
          onPress={() => {
            failNextTick.current = true;
          }}
        />
      </View>
    </View>
  );
}
