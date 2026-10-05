import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSelector } from "react-redux";
import { Pencil, Trash2, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  CategoryType,
  CategoryStatus,
  type CategoryResponse,
} from "@sora/contracts";

import { Button, closeOpenSwipeRow, ListItemEnter, Skeleton, StateView, SwipeableRow, SyncStatusDot, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { selectQueueEntryFor, useListCategoriesQuery } from '@/app/store';
import { isNetworkError } from '@/utils';
import type { AppStackScreenProps } from "@/app/navigation";
import { AddCategoryModal } from '../components/AddCategoryModal.tsx';
import { CategoryManageDialog, type CategoryDialogMode } from '../components/CategoryManageDialog.tsx';

/** One list per category type — a category has exactly one type, matching the transactions it can label. */
export function CategoryListScreen({
  route,
}: AppStackScreenProps<"CategoryList">) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet, permissions, isLoading: walletsLoading } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<{ category: CategoryResponse; mode: CategoryDialogMode } | null>(null);

  const expense = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.EXPENSE,
    status: CategoryStatus.ACTIVE,
  }, { skip: walletId === undefined });
  const income = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.INCOME,
    status: CategoryStatus.ACTIVE,
  }, { skip: walletId === undefined });
  const transfer = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.TRANSFER,
    status: CategoryStatus.ACTIVE,
  }, { skip: walletId === undefined });

  const renderContent = () => {
    if (walletId === undefined) {
      return (
        <StateView
          variant="error"
          error={
            new Error(t("categories.noWalletSelected", "No wallet selected."))
          }
        />
      );
    }
    if (expense.isLoading || income.isLoading || transfer.isLoading || walletsLoading) {
      return (
                <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {permissions.canWrite ? (
            <View style={{ marginBottom: theme.spacing.sm }}>
              <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.badge.md} radius={theme.radius.md} />
            </View>
          ) : null}

          {['categories.expenseCategories', 'categories.incomeCategories', 'categories.transferCategories'].map((titleKey) => (
            <View key={titleKey}>
              <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.xs }}>
                {t(titleKey)}
              </Text>
              {Array.from({ length: 2 }).map((_, i) => (
                <CategoryItemSkeleton key={i} />
              ))}
            </View>
          ))}
        </View>
      );
    }
    const failed = [expense, income, transfer].find((query) => query.isError && !isNetworkError(query.error));
    if (failed !== undefined) {
      return <StateView variant="error" error={failed.error} retryAction={() => void failed.refetch()} />;
    }

    const sections = [
      { title: t('categories.expenseCategories'), data: expense.data ?? [] },
      { title: t('categories.incomeCategories'), data: income.data ?? [] },
      { title: t('categories.transferCategories'), data: transfer.data ?? [] },
    ];

    return (
      <FlatList
        testID="list-categories"
        data={sections}
        keyExtractor={(section) => section.title}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        onScrollBeginDrag={closeOpenSwipeRow}
        ListHeaderComponent={
          permissions.canWrite ? (
            <Button label={t('categories.newCategory')} icon={Plus} size="sm" onPress={() => setCreating(true)} style={{ marginBottom: theme.spacing.sm }} />
          ) : null
        }
        renderItem={({ item: section }) => (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.xs }}>
              {section.title}
            </Text>
            {section.data.length === 0 ? (
              <Text tone="faint">{t('categories.noneYet')}</Text>
            ) : (
              section.data.map((category) => (
                <ListItemEnter key={category.id}>
                  <SwipeableRow
                    backgroundColor={theme.colors.background}
                    actions={
                      permissions.canWrite
                        ? [
                            { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => setManaging({ category, mode: 'rename' }), testID: 'btn-edit-category' },
                            { key: 'delete', label: t('common.delete'), icon: Trash2, tone: 'danger', onPress: () => setManaging({ category, mode: 'choose' }), testID: 'btn-delete-category' },
                          ]
                        : []
                    }
                  >
                    <CategoryItem
                      category={category}
                      canDelete={permissions.canWrite}
                      onDelete={() => setManaging({ category, mode: 'choose' })}
                    />
                  </SwipeableRow>
                </ListItemEnter>
              ))
            )}
          </View>
        )}
      />
    );
  };

  return (
    <>
      {renderContent()}
      {walletId !== undefined ? (
        <AddCategoryModal visible={creating} walletId={walletId} onClose={() => setCreating(false)} />
      ) : null}
      <CategoryManageDialog
        category={managing?.category ?? null}
        initialMode={managing?.mode ?? 'choose'}
        onClose={() => setManaging(null)}
      />
    </>
  );
}

  function CategoryItem({
    category,
    canDelete,
    onDelete,
  }: {
    category: CategoryResponse;
    canDelete: boolean;
    onDelete: () => void;
  }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const syncStatus = useSelector(
      selectQueueEntryFor("category", category.id),
    )?.status;
    return (
      <View
        className="flex-row items-center"
        style={{
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        }}
      >
        <View
          style={{
            width: theme.sizes.dot.lg,
            height: theme.sizes.dot.lg,
            borderRadius: theme.radius.pill,
            backgroundColor: category.color ?? theme.colors.textFaint,
          }}
        />
        <Text style={{ flex: 1 }}>{category.name}</Text>
        <SyncStatusDot status={syncStatus} />
        {canDelete ? (
          <Pressable
            testID={`btn-delete-category-${category.id}`}
            onPress={onDelete}
            hitSlop={(theme.sizes.touchTarget - theme.iconSize.md) / 2}
            accessibilityRole="button"
            accessibilityLabel={t("categories.deleteCategoryA11y", { name: category.name })}
          >
            <Trash2 size={theme.iconSize.md} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  function CategoryItemSkeleton() {
    const theme = useTheme();
    return (
      <View
        className="flex-row items-center"
        style={{
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        }}
      >
        <Skeleton width={theme.sizes.dot.lg} height={theme.sizes.dot.lg} radius={theme.radius.pill} />
        <View style={{ flex: 1 }}>
          <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        </View>
        <Skeleton width={theme.iconSize.md} height={theme.iconSize.md} radius={theme.radius.sm} />
      </View>
    );
  }
