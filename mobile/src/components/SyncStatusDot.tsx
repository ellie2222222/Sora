import { View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import type { QueueStatus } from '../services/sync/offlineQueueTypes.ts';

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
  if (!status || status === 'synced') return null;

  const color =
    status === 'failed' || status === 'conflict'
      ? theme.colors.danger
      : theme.colors.textFaint;

  return (
    <View
      testID={testID}
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
      }}
    />
  );
}
