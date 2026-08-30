import { History } from 'lucide-react-native';
import { SectionList, View } from 'react-native';
import type { AuditLogResponse } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { dayOfInstant, formatDayHeading, formatTimeOfDay } from '../../../utils/date.ts';
import { ROLE_LABELS } from '../../../utils/roles.ts';
import { useWalletActivity } from '../hooks/useWalletActivity.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

/** WAL-US-13. OWNER-only (API spec §15.1) — this screen is only ever reached from a control already gated to the owner. */
export function WalletActivityScreen({ route }: AppStackScreenProps<'WalletActivity'>) {
  const theme = useTheme();
  const { walletId } = route.params;

  const activity = useWalletActivity(walletId, { pageSize: 50 });

  if (activity.isLoading) return <SkeletonList rows={6} />;
  if (activity.isError) {
    return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} testID="wallet-activity-error" />;
  }

  const items = activity.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Every change made in this wallet will show up here."
        testID="wallet-activity-empty"
      />
    );
  }

  const sections = groupByDay(items);

  return (
    <SectionList
      testID="wallet-activity-list"
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
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
  const failed = entry.result !== 'SUCCESS';

  return (
    <Card testID={`wallet-activity-${entry.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold">{humanizeEvent(entry.event)}</Text>
          <Text variant="caption" tone="muted">
            {entry.actorRole !== null ? `${ROLE_LABELS[entry.actorRole]} · ` : ''}
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
