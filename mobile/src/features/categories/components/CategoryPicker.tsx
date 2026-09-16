import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CategoryResponse, CategoryType } from '@sora/contracts';

import { BottomSheetModal, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useListCategoriesQuery } from '@/app/store';

export interface CategoryPickerProps {
  walletId: string;
  type: CategoryType;
  value: string | null;
  onChange: (categoryId: string) => void;
  error?: string;
  testID?: string;
}

export function CategoryPicker({ walletId, type, value, onChange, error, testID }: CategoryPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const categories = useListCategoriesQuery({ walletId, type, status: 'ACTIVE' });

  // Deliberate default-to-first-category UX shortcut, not just an init step:
  // clearing `value` back to empty while the list is already loaded will
  // immediately re-populate it with the first category, not leave it blank.
  useEffect(() => {
    const list = categories.data;
    if ((value === null || value === undefined || value === '') && list !== undefined && list.length > 0) {
      const first = list[0];
      if (first !== undefined) {
        onChange(first.id);
      }
    }
  }, [categories.data, value, onChange]);

  const selected = categories.data?.find((c) => c.id === value);

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
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
            {selected?.color !== undefined && selected.color !== null ? (
              <View className="w-[10px] h-[10px]" style={{ borderRadius: theme.radius.pill, backgroundColor: selected.color }} />
            ) : null}
            <Text tone={selected === undefined ? 'faint' : 'default'}>
              {selected === undefined ? t('categories.selectCategory', { defaultValue: 'Select a category' }) : selected.name}
            </Text>
          </View>
          <ChevronDown size={18} color={theme.colors.textMuted} />
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
          {(categories.data ?? []).map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              selected={category.id === value}
              onPress={() => {
                onChange(category.id);
                setOpen(false);
              }}
            />
          ))}
          {categories.data !== undefined && categories.data.length === 0 ? (
            <Text tone="faint" style={{ padding: theme.spacing.md, textAlign: 'center' }}>
              {t('categories.noCategoriesYet', { type: type.toLowerCase(), defaultValue: `No ${type.toLowerCase()} categories yet.` })}
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function CategoryRow({
  category,
  selected,
  onPress,
}: {
  category: CategoryResponse;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={`category-picker-item-${category.id}`}
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
            backgroundColor: category.color ?? theme.colors.textFaint,
          }}
        />
        <Text weight={selected ? 'semibold' : 'regular'}>{category.name}</Text>
      </View>
      {selected ? <Check size={16} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}
