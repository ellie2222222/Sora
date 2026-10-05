import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { isOpenStatus, type QueueStatus } from '@/services/sync';

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
  if (!status || !isOpenStatus(status)) return null;

  const color =
    status === 'failed' || status === 'conflict'
      ? theme.colors.danger
      : theme.colors.textFaint;

  return (
    <View
      testID={testID}
      style={{
        width: theme.sizes.dot.sm,
        height: theme.sizes.dot.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: color,
      }}
    />
  );
}
