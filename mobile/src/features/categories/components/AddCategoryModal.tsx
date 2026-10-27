import { useEffect, useState } from "react";
import { View } from "react-native";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CategoryType, createCategorySchema } from "@sora/contracts";

import { BottomSheetModal, Button, Input, SegmentedControl, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useCreateCategoryMutation } from '@/app/store';
import { issueMessagesByPath, messageOf } from '@/utils';

export function AddCategoryModal({
  visible,
  walletId,
  initialType = CategoryType.EXPENSE,
  onClose,
}: {
  visible: boolean;
  walletId: string;
  initialType?: CategoryType;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [createCategory, { isLoading: isCreating }] =
    useCreateCategoryMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts clean: a cancelled attempt's name and error must not come back with it.
  useEffect(() => {
    if (visible) {
      setName("");
      setType(initialType);
      setNameError(undefined);
      setError(null);
    }
  }, [visible, initialType]);

  async function handleCreate() {
    setError(null);
    const parsed = createCategorySchema.safeParse({ walletId, name, type });
    if (!parsed.success) {
      setNameError(issueMessagesByPath(parsed.error.issues, t).name);
      return;
    }
    setNameError(undefined);
    try {
      await createCategory(parsed.data).unwrap();
      setName("");
      onClose();
      showToast(t('toast.categoryAdded'), 'success');
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={t("categories.newCategory")}
      closeLabel="cancel"
      entity="category"
    >
      <View style={{ gap: theme.spacing.md }}>
        <Input
          testID="input-category-name"
          label={t("categories.name")}
          value={name}
          onChangeText={(next) => {
            setName(next);
            setNameError(undefined);
          }}
          error={nameError}
        />
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            { value: CategoryType.EXPENSE, label: t("categories.expense"), testID: "btn-category-type-EXPENSE" },
            { value: CategoryType.INCOME, label: t("categories.income"), testID: "btn-category-type-INCOME" },
            { value: CategoryType.TRANSFER, label: t("categories.transfer"), testID: "btn-category-type-TRANSFER" },
          ]}
        />
        {error !== null ? <Text tone="danger">{error}</Text> : null}
        <Button
          testID="btn-submit-category"
          label={t("categories.create")}
          icon={Plus}
          onPress={handleCreate}
          loading={isCreating}
          disabled={name.trim().length === 0}
          fullWidth
        />
      </View>
    </BottomSheetModal>
  );
}
