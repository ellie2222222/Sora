import { View } from 'react-native';
import { Card, SegmentedControlSkeleton, Skeleton, TransactionItemSkeleton } from '@/components';
import { useTheme } from '@/app/providers';

export function TransactionListSkeleton() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <PeriodSummarySkeleton />
      </View>

      {/* Tabs Skeleton */}
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <SegmentedControlSkeleton count={4} />
      </View>

      <View style={{ paddingHorizontal: theme.spacing.md, flex: 1 }}>
        <TransactionDaysSkeleton />
      </View>
    </View>
  );
}

/** Shaped like `PeriodSummaryCard`, for the summary while its window loads. */
export function PeriodSummarySkeleton() {
  const theme = useTheme();

  return (
    <Card elevated style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.sm }}>
        <View className="flex-row">
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
          </View>
        </View>
        <View
          style={{
            gap: theme.spacing.xs,
            paddingTop: theme.spacing.sm,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border,
          }}
        >
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        </View>
      </View>
    </Card>
  );
}

/** Day cards shaped like `TransactionDayCard`, for the list area alone while its rows load. */
export function TransactionDaysSkeleton() {
  const theme = useTheme();

  return (
    <>
      {[4, 2].map((rows, day) => (
        <View
          key={day}
          style={{ borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, marginBottom: theme.spacing.sm, ...theme.shadows.sm }}
        >
          <View
            className="flex-row justify-between items-center"
            style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}
          >
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
          </View>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
            {Array.from({ length: rows }).map((_, row) => (
              <TransactionItemSkeleton key={row} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}
