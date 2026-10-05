import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface ListLoadMoreFooterProps {
  isFetchingNextPage: boolean;
  /** The retry shows only while more pages exist, so a first-page error keeps its own full-screen state. */
  hasNextPage: boolean;
  isError: boolean;
  onRetry: () => void;
  testID?: string;
}

/** The `ListFooterComponent` of an infinite list: a spinner while the next page loads, a retry when it failed. */
export function ListLoadMoreFooter({ isFetchingNextPage, hasNextPage, isError, onRetry, testID }: ListLoadMoreFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (isFetchingNextPage) {
    return (
      <View style={{ paddingVertical: theme.spacing.md }} testID={testID}>
        <ActivityIndicator size="small" color={theme.colors.primary} accessibilityLabel={t('common.loadingMore')} />
      </View>
    );
  }

  if (isError && hasNextPage) {
    return (
      <View className="items-center" style={{ paddingVertical: theme.spacing.md, gap: theme.spacing.xs }} testID={testID}>
        <Text variant="caption" tone="muted">
          {t('common.loadMoreFailed')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          hitSlop={theme.sizes.hitSlop.md}
          testID={testID === undefined ? undefined : `${testID}-retry`}
        >
          <Text variant="label" weight="semibold">
            {t('common.tryAgain')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return null;
}
