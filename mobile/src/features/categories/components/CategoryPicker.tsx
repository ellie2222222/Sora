import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { CategoryResponse, CategoryType } from '@sora/contracts';

import { Card, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useCategories } from '../hooks/useCategories.ts';

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
  const [open, setOpen] = useState(false);
  const categories = useCategories({ walletId, type, status: 'ACTIVE' });
  const selected = categories.data?.find((c) => c.id === value);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        Category
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={{
          height: 48,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: error !== undefined ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {selected?.color !== undefined && selected.color !== null ? (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selected.color }} />
          ) : null}
          <Text tone={selected === undefined ? 'faint' : 'default'}>
            {selected === undefined ? 'Select a category' : selected.name}
          </Text>
        </View>
      </Pressable>
      {error !== undefined ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card elevated style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '70%' }}>
                <ScrollView>
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
                    <Text tone="faint" style={{ paddingVertical: theme.spacing.md }}>
                      No {type.toLowerCase()} categories yet.
                    </Text>
                  ) : null}
                </ScrollView>
              </Card>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: category.color ?? theme.colors.textFaint,
        }}
      />
      <Text weight={selected ? 'semibold' : 'regular'}>{category.name}</Text>
    </Pressable>
  );
}
