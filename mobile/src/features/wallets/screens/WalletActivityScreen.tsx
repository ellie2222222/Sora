import { useState } from 'react';
import { History } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AuditLogResponse } from '@sora/contracts';

import { Card, RefreshableSectionList, SkeletonList, StateView, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListAuditLogsQuery } from '@/app/store';
import { dayOfInstant, formatDayHeading, formatTimeOfDay } from '../../../utils/date.ts';
import { isNetworkError } from '../../../utils/errors.ts';
import { getRoleLabel } from '../../../utils/roles.ts';
import type { AppStackScreenProps } from '@/app/navigation';

/** WAL-US-13. OWNER-only (API spec §15.1) — this screen is only ever reached from a control already gated to the owner. */
export function WalletActivityScreen({ route }: AppStackScreenProps<'WalletActivity'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { walletId } = route.params;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activity = useListAuditLogsQuery({ walletId, query: { pageSize: 50 } });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await activity.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderContent = () => {
    if (activity.isLoading) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <SkeletonList rows={6} />
        </View>
      );
    }
    if (activity.isError && !isNetworkError(activity.error)) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView variant="error" error={activity.error} retryAction={() => void activity.refetch()} testID="wallet-activity-error" />
        </View>
      );
    }

    const items = activity.data?.items ?? [];

    if (items.length === 0) {
      return (
        <View style={{ padding: theme.spacing.md }}>
          <StateView
            variant="empty"
            icon={History}
            title={t('activity.noActivityYet')}
            message={t('activity.noActivityMessage')}
            testID="wallet-activity-empty"
          />
        </View>
      );
    }

    const sections = groupByDay(items);

    return (
      <RefreshableSectionList
        testID="wallet-activity-list"
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: theme.colors.background, paddingBottom: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <ActivityRow entry={item} />}
      />
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      {renderContent()}
    </View>
  );
}

function groupByDay(items: AuditLogResponse[]): { title: string; data: AuditLogResponse[] }[] {
  const byDay = new Map<string, AuditLogResponse[]>();
  for (const item of items) {
    const day = dayOfInstant(item.createdAt);
    const bucket = byDay.get(day);
    if (bucket !== undefined) bucket.push(item);
    else byDay.set(day, [item]);
  }
  return Array.from(byDay.entries()).map(([day, data]) => ({ title: formatDayHeading(day), data }));
}

function humanizeEvent(event: string): string {
  return event
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ActivityRow({ entry }: { entry: AuditLogResponse }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const failed = entry.result !== 'SUCCESS';

  return (
    <Card testID={`wallet-activity-${entry.id}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 gap-xxs">
          <Text weight="semibold">{humanizeEvent(entry.event)}</Text>
          <Text variant="caption" tone="muted">
            {entry.actorRole !== null ? `${getRoleLabel(entry.actorRole, t)} · ` : ''}
            {entry.entityType}
            {failed ? ` · ${entry.result.toLowerCase()}` : ''}
          </Text>
        </View>
        <Text variant="caption" tone={failed ? 'danger' : 'muted'}>
          {formatTimeOfDay(entry.createdAt)}
        </Text>
      </View>
    </Card>
  );
}
