import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CategoryStatus, type CategoryResponse, type CategoryType } from '@sora/contracts';

import { StateView, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { ensureContrast } from '@/design-system';
import { useListCategoriesQuery } from '@/app/store';
import { useDefaultToFirst } from '@/hooks';
import { categoryIconFor } from '@/utils';

export interface CategoryGridProps {
  walletId: string;
  type: CategoryType;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  /** No auto-pick, and tapping the selected category clears it — for a transfer, where one is optional. */
  optional?: boolean;
  error?: string;
  testID?: string;
}

const COLUMNS = 4;

/**
 * The inline, always-visible category chooser: a scrollable icon grid, for a form whose own
 * scroll region already holds it.
 */
export function CategoryGrid({ walletId, type, value, onChange, optional = false, error, testID }: CategoryGridProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const categories = useListCategoriesQuery({ walletId, type, status: CategoryStatus.ACTIVE });

  // Not `data`: after `type` or `walletId` changes it still holds the previous list, and would default to
  // a category of the wrong type that the request then fails on.
  useDefaultToFirst(categories.currentData, value, (first) => onChange(first.id), !optional);

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <Text variant="label" tone="muted">
        {t('categories.categoryLabel', { defaultValue: 'Category' })}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(categories.currentData ?? []).map((category) => (
          <CategoryCell
            key={category.id}
            category={category}
            selected={category.id === value}
            onPress={() => {
              requestAnimationFrame(() => {
                onChange(optional && category.id === value ? null : category.id);
              });
            }}
          />
        ))}
      </View>
      {categories.currentData === undefined && categories.isError ? (
        <StateView
          variant="error"
          error={categories.error}
          retryAction={() => void categories.refetch()}
          testID={testID !== undefined ? `${testID}-error` : undefined}
          entrance="none"
        />
      ) : null}
      {categories.currentData !== undefined && categories.currentData.length === 0 ? (
        <Text tone="faint" style={{ padding: theme.spacing.md, textAlign: 'center' }}>
          {t(`categories.noCategoriesOfType.${type}`)}
        </Text>
      ) : null}
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function CategoryCell({
  category,
  selected,
  onPress,
}: {
  category: CategoryResponse;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const Icon = categoryIconFor(category.icon);
  const storedTint = category.color ?? theme.colors.primary;
  const iconTint = ensureContrast(storedTint, theme.colors.surfaceMuted, 3, theme.colors.text);
  const letterTint = ensureContrast(storedTint, theme.colors.surfaceMuted, 4.5, theme.colors.text);

  const selectedFgIcon = ensureContrast(theme.colors.surface, storedTint, 3, theme.colors.text);
  const selectedFgLetter = ensureContrast(theme.colors.surface, storedTint, 4.5, theme.colors.text);

  return (
    <Pressable
      testID={`option-category-${category.id}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        width: `${100 / COLUMNS}%`,
        alignItems: 'center',
        gap: theme.spacing.xxs,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
      }}
    >
      <View
        style={{
          width: theme.sizes.touchTarget,
          height: theme.sizes.touchTarget,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? storedTint : theme.colors.surfaceMuted,
        }}
      >
        {Icon !== null ? (
          <Icon size={theme.iconSize.xl} color={selected ? selectedFgIcon : iconTint} />
        ) : (
          <Text weight="semibold" style={{ color: selected ? selectedFgLetter : letterTint }}>
            {category.name.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <Text
        variant="caption"
        weight={selected ? 'semibold' : 'regular'}
        tone={selected ? 'default' : 'muted'}
        numberOfLines={2}
        style={{ textAlign: 'center' }}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}
