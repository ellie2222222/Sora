import { useState } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Tag, X } from 'lucide-react-native';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListCategoriesQuery } from '@/app/store';

/** The category a list was opened for, shown as an active filter the viewer can drop. */
export function CategoryFilterChip({
  walletId,
  categoryId,
  onClear,
  testID,
}: {
  walletId: string;
  categoryId: string;
  onClear: () => void;
  testID: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const categories = useListCategoriesQuery({ walletId });
  const name = categories.data?.find((category) => category.id === categoryId)?.name ?? t('categories.categoryLabel');

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('transactions.clearCategoryFilter', { category: name })}
      onPress={onClear}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="flex-row items-center"
      style={{
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.primary,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.primaryMuted,
      }}
    >
      <Tag size={theme.iconSize.sm} color={theme.colors.primary} />
      <Text variant="caption" weight="semibold" numberOfLines={1}>
        {name}
      </Text>
      <X size={theme.iconSize.sm} color={theme.colors.textMuted} />
    </Pressable>
  );
}
