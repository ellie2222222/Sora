import { useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { useSelector } from "react-redux";
import { Pencil, Trash2, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  CategoryType,
  CategoryStatus,
  type CategoryResponse,
} from "@sora/contracts";

import { Button, closeOpenSwipeRow, ListItemEnter, Skeleton, StateView, SwipeableRow, SyncStatusDot, Text, ThemedIcon, ThemedView } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { selectQueueEntryFor, useListCategoriesQuery } from '@/app/store';
import { isNetworkError, permissionsForWallet } from '@/utils';
import type { AppStackScreenProps } from "@/app/navigation";
import { AddCategoryModal } from '../components/AddCategoryModal.tsx';
import { CategoryManageDialog, type CategoryDialogMode } from '../components/CategoryManageDialog.tsx';

const SECTION_TITLE_KEYS: Record<CategoryType, string> = {
  [CategoryType.EXPENSE]: 'categories.expenseCategories',
  [CategoryType.INCOME]: 'categories.incomeCategories',
  [CategoryType.TRANSFER]: 'categories.transferCategories',
};

/** One list per category type — a category has exactly one type, matching the transactions it can label. */
export function CategoryListScreen({
  navigation,
  route,
}: AppStackScreenProps<"CategoryList">) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet, wallets, isLoading: walletsLoading } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  // The listed wallet's own role, not the active one's: this screen opens for any wallet from the switcher.
  const permissions = permissionsForWallet(wallets, walletId ?? '');
  const [creatingType, setCreatingType] = useState<CategoryType | null>(null);
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
          variant="empty"
          title={t("categories.noWalletSelected")}
          primaryAction={{ label: t("common.back"), onPress: () => navigation.goBack() }}
          testID="categories-no-wallet"
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

          {Object.values(SECTION_TITLE_KEYS).map((titleKey) => (
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
    const failed = [expense, income, transfer].find(
      (query) => query.isError && (!isNetworkError(query.error) || query.data === undefined),
    );
    if (failed !== undefined) {
      return <StateView variant="error" error={failed.error} retryAction={() => void failed.refetch()} />;
    }

    const sections = [
      { type: CategoryType.EXPENSE, data: expense.data ?? [] },
      { type: CategoryType.INCOME, data: income.data ?? [] },
      { type: CategoryType.TRANSFER, data: transfer.data ?? [] },
    ];

    return (
      <SectionList
        testID="list-categories"
        sections={sections}
        keyExtractor={(category) => category.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: theme.spacing.md }}
        onScrollBeginDrag={closeOpenSwipeRow}
        ListHeaderComponent={
          permissions.canWrite ? (
            <Button
              testID="btn-add-category"
              label={t('categories.newCategory')}
              icon={Plus}
              size="sm"
              onPress={() => setCreatingType(CategoryType.EXPENSE)}
              style={{ marginBottom: theme.spacing.sm }}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="muted" style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.xs }}>
            {t(SECTION_TITLE_KEYS[section.type])}
          </Text>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <View style={{ gap: theme.spacing.sm, alignItems: 'flex-start' }}>
              <Text tone="faint">{t(`categories.noCategoriesOfType.${section.type}`)}</Text>
              {permissions.canWrite ? (
                <Button
                  testID={`btn-add-category-${section.type}`}
                  label={t('categories.newCategory')}
                  icon={Plus}
                  size="sm"
                  variant="secondary"
                  onPress={() => setCreatingType(section.type)}
                />
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item: category }) => (
          <ListItemEnter>
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
        )}
      />
    );
  };

  return (
    <View testID="screen-categories" className="flex-1">
      {renderContent()}
      {walletId !== undefined ? (
        <AddCategoryModal
          visible={creatingType !== null}
          walletId={walletId}
          initialType={creatingType ?? CategoryType.EXPENSE}
          onClose={() => setCreatingType(null)}
        />
      ) : null}
      <CategoryManageDialog
        category={managing?.category ?? null}
        initialMode={managing?.mode ?? 'choose'}
        onClose={() => setManaging(null)}
      />
    </View>
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
      <ThemedView
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
          <ThemedIcon icon={Trash2} size={theme.iconSize.md} color={theme.colors.textFaint} />
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
