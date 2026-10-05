import { useState } from "react";
import { View } from "react-native";
import { Plus, ArrowUpFromLine, ArrowDownToLine, ArrowRightLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CategoryType } from "@sora/contracts";

import { BottomSheetModal, Button, Input, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useCreateCategoryMutation } from '@/app/store';
import { messageOf } from '@/utils';

export function AddCategoryModal({
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
            icon={ArrowUpFromLine}
            size="sm"
            variant={type === CategoryType.EXPENSE ? "primary" : "secondary"}
            onPress={() => setType(CategoryType.EXPENSE)}
          />
          <Button
            testID="btn-category-type-INCOME"
            label={t("categories.income")}
            icon={ArrowDownToLine}
            size="sm"
            variant={type === CategoryType.INCOME ? "primary" : "secondary"}
            onPress={() => setType(CategoryType.INCOME)}
          />
          <Button
            testID="btn-category-type-TRANSFER"
            label={t("categories.transfer")}
            icon={ArrowRightLeft}
            size="sm"
            variant={type === CategoryType.TRANSFER ? "primary" : "secondary"}
            onPress={() => setType(CategoryType.TRANSFER)}
          />
        </View>
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
