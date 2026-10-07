import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Archive, Pencil, Trash2, Save } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { CategoryResponse } from "@sora/contracts";

import { BottomSheetModal, Button, Input, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useArchiveCategoryMutation, useDeleteCategoryPermanentlyMutation, useUpdateCategoryMutation } from '@/app/store';
import { messageOf } from '@/utils';

export type CategoryDialogMode = "choose" | "rename";

/** API spec §10.4. */
export function CategoryManageDialog({
  category,
  initialMode,
  onClose,
}: {
  category: CategoryResponse | null;
  /** `rename` when opened from a row's Edit action: Cancel then closes instead of backing out to the chooser. */
  initialMode: CategoryDialogMode;
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
  const [mode, setMode] = useState<CategoryDialogMode>(initialMode);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setName(category?.name ?? "");
    setError(null);
  }, [category, initialMode]);

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
      closeLabel={mode === "rename" ? "cancel" : "close"}
      // Rename reached from the options list is a step inside this sheet: Back returns to the list.
      onBack={mode === "rename" && initialMode !== "rename" ? () => setMode("choose") : undefined}
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
          <Button
            testID="btn-submit-category-rename"
            label={t("common.save")}
            icon={Save}
            onPress={handleRename}
            loading={isRenaming}
            disabled={name.trim().length === 0}
            fullWidth
          />
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
            icon={<Pencil size={theme.iconSize.lg} color={theme.colors.text} />}
            label={t("categories.renameCategory")}
            description={t("categories.renameDescription")}
            onPress={() => setMode("rename")}
          />
          <DeleteOption
            testID="btn-archive-category"
            icon={<Archive size={theme.iconSize.lg} color={theme.colors.text} />}
            label={t("categories.archiveCategory")}
            description={t("categories.archiveDescription")}
            onPress={handleArchive}
            loading={isArchiving}
          />
          <DeleteOption
            testID="btn-delete-permanent-category"
            icon={
              <Trash2
                size={theme.iconSize.lg}
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
        opacity: disabled ? theme.opacity.disabled : 1,
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
