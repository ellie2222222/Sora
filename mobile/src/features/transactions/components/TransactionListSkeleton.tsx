import { View, Platform } from 'react-native';
import { Card, Skeleton, TransactionItemSkeleton } from '@/components';
import { useTheme } from '@/app/providers';

export function TransactionListSkeleton() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs }}>
        {/* We leave space for the real PeriodBar which is rendered outside, but if this skeleton encompasses the summary card, we put it here */}
        <View style={{ marginTop: theme.spacing.sm }}>
          <Card elevated style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.sm }}>
              <View className="flex-row">
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Skeleton width={60} height={12} radius={theme.radius.sm} />
                  <Skeleton width={120} height={24} radius={theme.radius.sm} />
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Skeleton width={60} height={12} radius={theme.radius.sm} />
                  <Skeleton width={100} height={24} radius={theme.radius.sm} />
                </View>
              </View>
              <View
                style={{
                  gap: theme.spacing.xs,
                  paddingTop: theme.spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                }}
              >
                <Skeleton width={80} height={12} radius={theme.radius.sm} />
                <Skeleton width={90} height={16} radius={theme.radius.sm} />
              </View>
            </View>
          </Card>
        </View>
      </View>

      {/* Tabs Skeleton */}
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          paddingTop: theme.spacing.xs,
        }}
      >
        <View
          className="flex-row p-[3px] border"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            borderColor: theme.colors.border,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              className="flex-1 py-sm items-center justify-center"
              style={[
                {
                  borderRadius: theme.radius.sm,
                  backgroundColor: i === 0 ? theme.colors.surface : 'transparent',
                },
                i === 0
                  ? Platform.select({
                      web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.08)' } as any,
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 1,
                      },
                    })
                  : undefined,
              ]}
            >
              <Skeleton width={50} height={16} radius={theme.radius.sm} />
            </View>
          ))}
        </View>
      </View>

      {/* Date Header + Items Skeleton */}
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, flex: 1 }}>
        {/* Section 1 */}
        <View style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xxs }}>
          <Skeleton width={90} height={18} radius={theme.radius.sm} />
        </View>
        <View
          className="flex-row justify-between items-end"
          style={{
            marginBottom: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <Skeleton width={110} height={16} radius={theme.radius.sm} />
          <Skeleton width={70} height={14} radius={theme.radius.sm} />
        </View>
        
        {Array.from({ length: 4 }).map((_, i) => (
          <TransactionItemSkeleton key={`section1-${i}`} />
        ))}
        
        {/* Section 2 */}
        <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xxs }}>
          <Skeleton width={105} height={18} radius={theme.radius.sm} />
        </View>
        <View
          className="flex-row justify-between items-end"
          style={{
            marginBottom: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <Skeleton width={130} height={16} radius={theme.radius.sm} />
          <Skeleton width={60} height={14} radius={theme.radius.sm} />
        </View>

        {Array.from({ length: 2 }).map((_, i) => (
          <TransactionItemSkeleton key={`section2-${i}`} />
        ))}
      </View>
    </View>
  );
}