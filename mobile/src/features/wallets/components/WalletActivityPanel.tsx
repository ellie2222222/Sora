import { useMemo, useState } from 'react';
import { History } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AuditLogResponse } from '@sora/contracts';

import { Card, ListLoadMoreFooter, RefreshableSectionList, Skeleton, StateView, Text, ThemedView } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useListAuditLogsInfiniteQuery } from '@/app/store';
import {
  canLoadMore,
  flattenPages,
  formatDayHeading,
  formatTimeOfDay,
  getRoleLabel,
  groupConsecutiveByDay,
  today,
} from '@/utils';

/** WAL-US-13. OWNER-only (API spec §15.1) — only ever reached from a control already gated to the owner. */
export function WalletActivityPanel({ walletId }: { walletId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activity = useListAuditLogsInfiniteQuery({ walletId });
  const items = useMemo(() => flattenPages(activity.data?.pages), [activity.data]);
  const { wallets, timeZone: activeTimeZone } = useWallets();
  const timeZone = wallets.find((wallet) => wallet.id === walletId)?.timeZone ?? activeTimeZone;
  const sections = useMemo(() => groupByDay(items, timeZone), [items, timeZone]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await activity.refetch({ refetchCachedPages: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (activity.isLoading) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </View>
    );
  }
  if (activity.isError && items.length === 0) {
    return (
      <StateView
        variant="error"
        error={activity.error}
        retryAction={() => void activity.refetch()}
        testID="wallet-activity-error"
        entrance="none"
      />
    );
  }
  if (items.length === 0) {
    return (
      <StateView
        variant="empty"
        icon={History}
        title={t('activity.noActivityYet')}
        message={t('activity.noActivityMessage')}
        testID="wallet-activity-empty"
        entrance="none"
      />
    );
  }

  return (
    <RefreshableSectionList
      testID="list-activity"
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      renderSectionHeader={({ section }) => (
        <ThemedView style={{ backgroundColor: theme.colors.surfaceElevated, paddingBottom: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {section.title}
          </Text>
        </ThemedView>
      )}
      renderItem={({ item }) => <ActivityItem entry={item} />}
      onEndReached={() => {
        if (canLoadMore(activity)) void activity.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        <ListLoadMoreFooter
          isFetchingNextPage={activity.isFetchingNextPage}
          hasNextPage={activity.hasNextPage}
          isError={activity.isError}
          onRetry={() => void activity.fetchNextPage()}
          testID="wallet-activity-list-footer"
        />
      }
    />
  );
}

function groupByDay(items: readonly AuditLogResponse[], timeZone: string): { title: string; data: AuditLogResponse[] }[] {
  return groupConsecutiveByDay(items, (item) => item.createdAt, timeZone).map(({ day, items: data }) => ({
    title: formatDayHeading(day, today(timeZone)),
    data,
  }));
}

/** Fallback for a code the catalog doesn't name yet: the server's vocabulary can grow ahead of the app's. */
function humanizeCode(code: string): string {
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ActivityItem({ entry }: { entry: AuditLogResponse }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const failed = entry.result !== 'SUCCESS';

  return (
    <Card testID={`row-activity-${entry.id}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 gap-xxs">
          <Text weight="semibold">
            {t(`activity.events.${entry.event}`, { defaultValue: humanizeCode(entry.event) })}
          </Text>
          <Text variant="caption" tone="muted">
            {entry.actorRole !== null ? `${getRoleLabel(entry.actorRole, t)} · ` : ''}
            {t(`activity.entityTypes.${entry.entityType}`, { defaultValue: humanizeCode(entry.entityType) })}
            {failed ? ` · ${t(`activity.results.${entry.result}`)}` : ''}
          </Text>
        </View>
        <Text variant="caption" tone={failed ? 'danger' : 'muted'}>
          {formatTimeOfDay(entry.createdAt)}
        </Text>
      </View>
    </Card>
  );
}

function ActivityItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 gap-xxs">
          <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.body} radius={theme.radius.xs} />
          <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.caption} radius={theme.radius.xs} />
        </View>
        <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.caption} radius={theme.radius.xs} />
      </View>
    </Card>
  );
}
