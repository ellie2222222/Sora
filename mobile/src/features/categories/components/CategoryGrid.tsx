import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CategoryResponse, CategoryType } from '@sora/contracts';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { ensureContrast } from '@/design-system';
import { useListCategoriesQuery } from '@/app/store';
import { useDefaultToFirst } from '@/hooks';
import { categoryIconFor } from '@/utils';

import { CATEGORY_TYPE_LABEL_KEY } from './categoryTypeLabel.ts';

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
 * The inline, always-visible category chooser for the add-transaction screen — a scrollable
 * icon grid rather than `CategoryPicker`'s tap-to-open sheet, since this screen's own scroll
 * region already holds it alongside the account/date fields (no nested sheet needed).
 */
export function CategoryGrid({ walletId, type, value, onChange, optional = false, error, testID }: CategoryGridProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const categories = useListCategoriesQuery({ walletId, type, status: 'ACTIVE' });

  useDefaultToFirst(categories.data, value, (first) => onChange(first.id), !optional);
  const typeLabel = t(CATEGORY_TYPE_LABEL_KEY[type]).toLowerCase();


  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <Text variant="label" tone="muted">
        {t('categories.categoryLabel', { defaultValue: 'Category' })}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(categories.data ?? []).map((category) => (
          <CategoryCell
            key={category.id}
            category={category}
            selected={category.id === value}
            onPress={() => onChange(optional && category.id === value ? null : category.id)}
          />
        ))}
      </View>
      {categories.data !== undefined && categories.data.length === 0 ? (
        <Text tone="faint" style={{ padding: theme.spacing.md, textAlign: 'center' }}>
          {t('categories.noCategoriesYet', { type: typeLabel })}
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
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: selected ? 1.5 : 0,
          borderColor: theme.colors.primary,
        }}
      >
        {Icon !== null ? (
          <Icon size={20} color={iconTint} strokeWidth={2} />
        ) : (
          <Text weight="semibold" style={{ color: letterTint }}>
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
