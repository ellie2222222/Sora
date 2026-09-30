import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { useSelector } from "react-redux";
import { Archive, Pencil, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  CategoryType,
  CategoryStatus,
  type CategoryResponse,
} from "@sora/contracts";

import { BottomSheetModal, Button, Input, ListItemEnter, SkeletonList, StateView, SyncStatusDot, Text } from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
import { selectQueueEntryFor, useArchiveCategoryMutation, useCreateCategoryMutation, useDeleteCategoryPermanentlyMutation, useListCategoriesQuery, useUpdateCategoryMutation } from '@/app/store';
import { isNetworkError, messageOf } from '@/utils';
import type { AppStackScreenProps } from "@/app/navigation";

/** One list per category type — a category has exactly one type, matching the transactions it can label. */
export function CategoryListScreen({
  route,
}: AppStackScreenProps<"CategoryList">) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWallet, permissions, isLoading: walletsLoading } = useWallets();
  const walletId = route.params?.walletId ?? activeWallet?.id;
  const [creating, setCreating] = useState(false);
  const [deletingCategory, setDeletingCategory] =
    useState<CategoryResponse | null>(null);

  const expense = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.EXPENSE,
    status: CategoryStatus.ACTIVE,
  });
  const income = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.INCOME,
    status: CategoryStatus.ACTIVE,
  });
  const transfer = useListCategoriesQuery({
    walletId: walletId ?? "",
    type: CategoryType.TRANSFER,
    status: CategoryStatus.ACTIVE,
  });

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
    if (expense.isLoading || income.isLoading || transfer.isLoading || walletsLoading) return <SkeletonList rows={6} rowHeight={44} />;
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
        ListHeaderComponent={
          permissions.canWrite ? (
            <Button label={t('categories.newCategory')} size="sm" onPress={() => setCreating(true)} style={{ marginBottom: theme.spacing.sm }} />
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
                  <CategoryRow
                    category={category}
                    canDelete={permissions.canWrite}
                    onDelete={() => setDeletingCategory(category)}
                  />
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
      <CategoryDeleteDialog category={deletingCategory} onClose={() => setDeletingCategory(null)} />
    </>
  );
}

  function CategoryRow({
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
          className="w-[10px] h-[10px]"
          style={{
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
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("categories.deleteCategoryA11y", { name: category.name })}
          >
            <Trash2 size={16} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  function AddCategoryModal({
    visible,
    walletId,
    onClose,
  }: {
    visible: boolean;
    walletId: string;
    onClose: () => void;
  }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [createCategory, { isLoading: isCreating }] =
      useCreateCategoryMutation();
    const [name, setName] = useState("");
    const [type, setType] = useState<CategoryType>(CategoryType.EXPENSE);
    const [error, setError] = useState<string | null>(null);

    async function handleCreate() {
      setError(null);
      try {
        await createCategory({ walletId, name, type }).unwrap();
        setName("");
        onClose();
        showToast(t('toast.categoryAdded', { defaultValue: 'Category added' }), 'success');
      } catch (submitError) {
        setError(messageOf(submitError, t));
      }
    }

    return (
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title={t("categories.newCategory")}
      >
        <View style={{ gap: theme.spacing.md }}>
          <Input
            testID="input-category-name"
            label={t("categories.name")}
            value={name}
            onChangeText={setName}
          />
          <View className="flex-row" style={{ gap: theme.spacing.xs }}>
            <Button
              testID="btn-category-type-EXPENSE"
              label={t("categories.expense")}
              size="sm"
              variant={type === CategoryType.EXPENSE ? "primary" : "secondary"}
              onPress={() => setType(CategoryType.EXPENSE)}
            />
            <Button
              testID="btn-category-type-INCOME"
              label={t("categories.income")}
              size="sm"
              variant={type === CategoryType.INCOME ? "primary" : "secondary"}
              onPress={() => setType(CategoryType.INCOME)}
            />
            <Button
              testID="btn-category-type-TRANSFER"
              label={t("categories.transfer")}
              size="sm"
              variant={type === CategoryType.TRANSFER ? "primary" : "secondary"}
              onPress={() => setType(CategoryType.TRANSFER)}
            />
          </View>
          {error !== null ? <Text tone="danger">{error}</Text> : null}
          <Button
            testID="btn-submit-category"
            label={t("categories.create")}
            onPress={handleCreate}
            loading={isCreating}
            disabled={name.trim().length === 0}
            fullWidth
          />
        </View>
      </BottomSheetModal>
    );
  }

  /** API spec §10.4. */
  function CategoryDeleteDialog({
    category,
    onClose,
  }: {
    category: CategoryResponse | null;
    onClose: () => void;
  }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const [updateCategory, { isLoading: isRenaming }] =
      useUpdateCategoryMutation();
    const [archiveCategory, { isLoading: isArchiving }] =
      useArchiveCategoryMutation();
    const [deleteCategory, { isLoading: isDeleting }] =
      useDeleteCategoryPermanentlyMutation();
    const [mode, setMode] = useState<"choose" | "rename">("choose");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      setMode("choose");
      setName(category?.name ?? "");
      setError(null);
    }, [category]);

    const unused = category?.transactionCount === 0;

    async function handleRename() {
      if (category === null) return;
      setError(null);
      try {
        await updateCategory({
          categoryId: category.id,
          body: { name },
        }).unwrap();
        onClose();
      } catch (submitError) {
        setError(messageOf(submitError, t));
      }
    }

    async function handleArchive() {
      if (category === null) return;
      setError(null);
      try {
        await archiveCategory(category.id).unwrap();
        onClose();
      } catch (submitError) {
        setError(messageOf(submitError, t));
      }
    }

    async function handleDeletePermanently() {
      if (category === null || unused !== true) return;
      setError(null);
      try {
        await deleteCategory(category.id).unwrap();
        onClose();
      } catch (submitError) {
        setError(messageOf(submitError, t));
      }
    }

    return (
      <BottomSheetModal
        visible={category !== null}
        onClose={onClose}
        title={
          category === null
            ? undefined
            : mode === "rename"
              ? t("categories.renameTitle", { name: category.name })
              : t("categories.deleteTitle", { name: category.name })
        }
      >
        {category === null ? null : mode === "rename" ? (
          <View style={{ gap: theme.spacing.md }}>
            <Input
              testID="input-category-new-name"
              label={t("categories.name")}
              value={name}
              onChangeText={setName}
            />
            {error !== null ? <Text tone="danger">{error}</Text> : null}
            <View className="flex-row" style={{ gap: theme.spacing.sm }}>
              <Button
                label={t("common.cancel")}
                variant="secondary"
                onPress={() => setMode("choose")}
                style={{ flex: 1 }}
              />
              <Button
                testID="btn-submit-category-rename"
                label={t("common.save")}
                onPress={handleRename}
                loading={isRenaming}
                disabled={name.trim().length === 0}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <Text tone="muted">
              {category.transactionCount > 0
                ? t("categories.usedByTransactions", {
                    count: category.transactionCount,
                  })
                : t("categories.noTransactions")}
            </Text>
            <Text variant="label" tone="muted">
              {t("categories.whatWouldYouDo")}
            </Text>

            <DeleteOption
              testID="btn-rename-category"
              icon={<Pencil size={18} color={theme.colors.text} />}
              label={t("categories.renameCategory")}
              description={t("categories.renameDescription")}
              onPress={() => setMode("rename")}
            />
            <DeleteOption
              testID="btn-archive-category"
              icon={<Archive size={18} color={theme.colors.text} />}
              label={t("categories.archiveCategory")}
              description={t("categories.archiveDescription")}
              onPress={handleArchive}
              loading={isArchiving}
            />
            <DeleteOption
              testID="btn-delete-permanent-category"
              icon={
                <Trash2
                  size={18}
                  color={
                    unused === true
                      ? theme.colors.danger
                      : theme.colors.textFaint
                  }
                />
              }
              label={t("categories.deletePermanently")}
              description={
                unused === true
                  ? t("categories.deleteDescription")
                  : t("categories.deleteDisabledDescription")
              }
              onPress={handleDeletePermanently}
              disabled={unused !== true}
              danger
              loading={isDeleting}
            />

            {error !== null ? <Text tone="danger">{error}</Text> : null}
            <Button
              label={t("common.cancel")}
              variant="ghost"
              onPress={onClose}
              fullWidth
            />
          </View>
        )}
      </BottomSheetModal>
    );
  }

  function DeleteOption({
    testID,
    icon,
    label,
    description,
    onPress,
    disabled = false,
    danger = false,
    loading = false,
  }: {
    testID: string;
    icon: ReactNode;
    label: string;
    description: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
    loading?: boolean;
  }) {
    const theme = useTheme();
    const isDisabled = disabled || loading;

    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={isDisabled}
        className="flex-row items-center"
        style={{
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon}
        <View className="flex-1">
          <Text
            weight="semibold"
            tone={danger && !disabled ? "danger" : "default"}
          >
            {label}
          </Text>
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        </View>
        {loading ? <ActivityIndicator color={theme.colors.textMuted} /> : null}
      </Pressable>
    );
  }
