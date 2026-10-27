import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { isOpenStatus, type QueueStatus } from '@/services/sync';
import { ThemedView } from './Themed.tsx';

export interface SyncStatusDotProps {
  status: QueueStatus | undefined;
  testID?: string;
}

/**
 * A small colour-coded dot for a record still moving through the offline
 * queue — shared so every entity's row picks the same status→colour mapping
 * instead of reinventing it. Renders nothing once `synced` (or unset —
 * a record that was never queued at all).
 */
export function SyncStatusDot({ status, testID }: SyncStatusDotProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!status || !isOpenStatus(status)) return null;

  const failed = status === 'failed' || status === 'conflict';
  const color = failed ? theme.colors.danger : theme.colors.textFaint;

  return (
    <ThemedView
      testID={testID}
      accessible
      accessibilityLabel={t(failed ? 'errors.syncStatusFailed' : 'errors.syncStatusPending')}
      style={{
        width: theme.sizes.dot.sm,
        height: theme.sizes.dot.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: color,
      }}
    />
  );
}
