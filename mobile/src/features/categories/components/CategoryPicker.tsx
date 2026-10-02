import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CategoryStatus, type CategoryType } from '@sora/contracts';

import { BottomSheetModal, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListCategoriesQuery } from '@/app/store';
import { useDefaultToFirst } from '@/hooks';

import { CATEGORY_TYPE_LABEL_KEY } from './categoryTypeLabel.ts';

export interface CategoryPickerProps {
  walletId: string;
  type: CategoryType;
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Makes the category optional (a transfer's): no auto-pick, plus a "No category" choice that calls this. */
  onClear?: () => void;
  error?: string;
  testID?: string;
}

export function CategoryPicker({ walletId, type, value, onChange, onClear, error, testID }: CategoryPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const categories = useListCategoriesQuery({ walletId, type, status: CategoryStatus.ACTIVE });

  useDefaultToFirst(categories.data, value, (first) => onChange(first.id), onClear === undefined);
  const typeLabel = t(CATEGORY_TYPE_LABEL_KEY[type]).toLowerCase();
  const noCategoryLabel = t('categories.noCategory');

  const selected = categories.data?.find((c) => c.id === value);
  const placeholder = onClear !== undefined ? noCategoryLabel : t('categories.selectCategory', { defaultValue: 'Select a category' });

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {t('categories.categoryLabel', { defaultValue: 'Category' })}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        className="h-[48px] border justify-center"
        style={{
          borderRadius: theme.radius.md,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <ChevronDown size={18} color={theme.colors.textMuted} />
          <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
            {selected?.color !== undefined && selected.color !== null ? (
              <View className="w-[10px] h-[10px]" style={{ borderRadius: theme.radius.pill, backgroundColor: selected.color }} />
            ) : null}
            <Text tone={selected === undefined ? 'faint' : 'default'}>
              {selected === undefined ? placeholder : selected.name}
            </Text>
          </View>
        </View>
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <BottomSheetModal
        visible={open}
        onClose={() => setOpen(false)}
        title={t('categories.selectCategory', { defaultValue: 'Select a category' })}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className="max-h-[360px]"
          contentContainerClassName="gap-xs"
          contentContainerStyle={{ paddingBottom: theme.spacing.md }}
        >
          {onClear !== undefined ? (
            <CategoryItem
              testID="option-category-none"
              label={noCategoryLabel}
              color={null}
              selected={value === null}
              onPress={() => {
                setOpen(false);
                requestAnimationFrame(() => {
                  onClear();
                });
              }}
            />
          ) : null}
          {(categories.data ?? []).map((category) => (
            <CategoryItem
              key={category.id}
              testID={`option-category-${category.id}`}
              label={category.name}
              color={category.color}
              selected={category.id === value}
              onPress={() => {
                setOpen(false);
                requestAnimationFrame(() => {
                  onChange(category.id);
                });
              }}
            />
          ))}
          {categories.data !== undefined && categories.data.length === 0 ? (
            <Text tone="faint" style={{ padding: theme.spacing.md, textAlign: 'center' }}>
              {t('categories.noCategoriesYet', { type: typeLabel })}
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function CategoryItem({
  label,
  color,
  selected,
  onPress,
  testID,
}: {
  label: string;
  color: string | null;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <View
          className="w-[10px] h-[10px]"
          style={{
            borderRadius: theme.radius.pill,
            backgroundColor: color ?? theme.colors.textFaint,
          }}
        />
        <Text weight={selected ? 'semibold' : 'regular'}>{label}</Text>
      </View>
      {selected ? <Check size={16} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}
