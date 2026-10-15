import { useState } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { RefreshCw, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { selectStuckRows } from '@/app/store';
import { useNetworkStatus } from '@/hooks';
import type { QueuedMutation } from '@/services/sync';
import { formatMoneyString, messageForCode } from '@/utils';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { Text } from './Text';

/** Enough of a queued write's own payload to recognise it: its amount, else its name or note. */
function detailOf(row: QueuedMutation): string | null {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  if (typeof payload.amount === 'string' && typeof payload.currency === 'string') return formatMoneyString(payload.amount, payload.currency);
  if (typeof payload.name === 'string') return payload.name;
  if (typeof payload.description === 'string') return payload.description;
  return null;
}

/**
 * The writes the server refused, each with why and a way out: try it again, or discard it. A refused
 * write otherwise waits forever and holds back every later change to the same record.
 */
export function StuckWritesList({ onDiscard }: { onDiscard: (row: QueuedMutation) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rows = useSelector(selectStuckRows);
  const { isOnline, retryQueued } = useNetworkStatus();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }} testID="list-stuck-writes">
      {rows.map((row) => {
        const detail = detailOf(row);
        return (
          <Card key={row.queueId} testID={`row-stuck-write-${row.queueId}`} style={{ gap: theme.spacing.xs }}>
            <Text>
              {t(`errors.syncEntity.${row.entity}`)}
              {detail === null ? '' : ` · ${detail}`}
            </Text>
            <Text variant="caption" tone="muted">
              {messageForCode(row.errorCode, t)}
            </Text>
            <View className="flex-row" style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
              <Button
                testID={`btn-retry-stuck-write-${row.queueId}`}
                label={t('common.tryAgain')}
                icon={RefreshCw}
                variant="secondary"
                size="sm"
                disabled={!isOnline || retryingId !== null}
                loading={retryingId === row.queueId}
                onPress={() => {
                  setRetryingId(row.queueId);
                  void retryQueued(row.queueId).finally(() => setRetryingId(null));
                }}
              />
              <Button
                testID={`btn-discard-stuck-write-${row.queueId}`}
                label={t('errors.syncDiscardAction')}
                icon={Trash2}
                variant="danger-outline"
                size="sm"
                disabled={retryingId !== null}
                onPress={() => onDiscard(row)}
              />
            </View>
          </Card>
        );
      })}
    </View>
  );
}
