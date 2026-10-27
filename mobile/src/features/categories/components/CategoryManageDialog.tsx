import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Archive, Pencil, Trash2, Save } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { updateCategorySchema, type CategoryResponse } from "@sora/contracts";

import { BottomSheetModal, Button, Input, MutationConfirmDialog, Text, ThemedIcon } from '@/components';
import { useTheme } from '@/app/providers';
import { useArchiveCategoryMutation, useDeleteCategoryPermanentlyMutation, useUpdateCategoryMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';

export type CategoryDialogMode = "choose" | "rename";

type PendingAction = "archive" | "delete" | null;

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
  const [archiveCategory] = useArchiveCategoryMutation();
  const [deleteCategory] = useDeleteCategoryPermanentlyMutation();
  const [mode, setMode] = useState<CategoryDialogMode>(initialMode);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    setMode(initialMode);
    setName(category?.name ?? "");
    setNameError(undefined);
    setError(null);
    setPendingAction(null);
  }, [category, initialMode]);

  const unused = category?.transactionCount === 0;

  async function handleRename() {
    if (category === null) return;
    setError(null);
    const parsed = updateCategorySchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(issueMessagesByPath(parsed.error.issues, t).name);
      return;
    }
    setNameError(undefined);
    try {
      await updateCategory({
        categoryId: category.id,
        body: parsed.data,
      }).unwrap();
      onClose();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  function runPendingAction(): Promise<unknown> {
    if (category === null) return Promise.resolve();
    return pendingAction === "delete"
      ? deleteCategory(category.id).unwrap()
      : archiveCategory(category.id).unwrap();
  }

  function confirmAction(action: Exclude<PendingAction, null>) {
    setError(null);
    setPendingAction(action);
  }

  return (
    <BottomSheetModal
      visible={category !== null}
      onClose={onClose}
      closeLabel={mode === "rename" ? "cancel" : "close"}
      entity="category"
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
            onChangeText={(next) => {
              setName(next);
              setNameError(undefined);
            }}
            error={nameError}
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
            icon={<ThemedIcon icon={Pencil} size={theme.iconSize.lg} color={theme.colors.text} />}
            label={t("categories.renameCategory")}
            description={t("categories.renameDescription")}
            onPress={() => setMode("rename")}
          />
          <DeleteOption
            testID="btn-archive-category"
            icon={<ThemedIcon icon={Archive} size={theme.iconSize.lg} color={theme.colors.text} />}
            label={t("categories.archiveCategory")}
            description={t("categories.archiveDescription")}
            onPress={() => confirmAction("archive")}
          />
          <DeleteOption
            testID="btn-delete-permanent-category"
            icon={
              <ThemedIcon icon={Trash2}
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
            onPress={() => confirmAction("delete")}
            disabled={unused !== true}
            danger
          />

          {error !== null ? <Text tone="danger">{error}</Text> : null}
        </View>
      )}

      <MutationConfirmDialog
        visible={category !== null && pendingAction !== null}
        title={
          category === null
            ? ""
            : pendingAction === "delete"
              ? t("categories.deleteTitle", { name: category.name })
              : t("categories.archiveConfirmTitle", { name: category.name })
        }
        message={pendingAction === "delete" ? t("categories.deleteConfirmBody") : t("categories.archiveConfirmBody")}
        confirmLabel={pendingAction === "delete" ? t("categories.deletePermanently") : t("categories.archiveCategory")}
        run={runPendingAction}
        onCancel={() => setPendingAction(null)}
        onDone={() => {
          setPendingAction(null);
          onClose();
        }}
        onError={(message) => {
          setPendingAction(null);
          setError(message);
        }}
      />
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
}: {
  testID: string;
  icon: ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className="flex-row items-center"
      style={{
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
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
    </Pressable>
  );
}
