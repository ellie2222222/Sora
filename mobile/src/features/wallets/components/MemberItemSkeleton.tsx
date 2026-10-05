import { View } from 'react-native';

import { Card, Skeleton } from '@/components';
import { useTheme } from '@/app/providers';

export function MemberItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <Skeleton width={theme.iconSize.lg} height={theme.iconSize.lg} radius={theme.radius.pill} />
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
          </View>
        </View>
        <Skeleton width={theme.iconSize.lg} height={theme.iconSize.lg} radius={theme.radius.pill} />
      </View>
    </Card>
  );
}
