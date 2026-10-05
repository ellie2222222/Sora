import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Save, Trash2 } from "lucide-react-native";
import {
  TransactionStatus,
  TransactionType,
  type TransactionResponse,
  type UpdateTransactionRequest,
} from "@sora/contracts";

import { BottomSheetModal, Button, DateField, Input, Skeleton, StateView, Text, ConfirmDialog } from '@/components';
import { useTheme } from "@/app/providers";
import { CategoryPicker } from "@/features/categories";
import {
  useGetTransactionQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} from "@/app/store";
import { categoryTypeFor, dayOfInstant, replaceDay, isNetworkError, messageOf } from '@/utils';

export interface EditTransactionModalProps {
  visible: boolean;
  transactionId?: string;
  onClose: () => void;
}

export function EditTransactionModal({
  visible,
  transactionId,
  onClose,
}: EditTransactionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const transaction = useGetTransactionQuery(transactionId ?? "", {
    skip: !visible || !transactionId,
  });
  const [updateTransaction, { isLoading: isSaving }] =
    useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: isDeleting }] = useDeleteTransactionMutation();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [description, setDescription] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  // undefined = untouched; null = the user removed a transfer's category.
  const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined);
  const [reference, setReference] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDescription(null);
      setDay(null);
      setCategoryId(undefined);
      setReference(null);
      setSubmitError(null);
      setDeleteError(null);
      setConfirmingDelete(false);
    }
  }, [visible, transactionId]);

  if (!visible || !transactionId) return null;

  if (transaction.isLoading) {
    return (
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title={t("transactions.editTransaction")}
      >
                <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl, marginTop: theme.spacing.md }}>
          <Skeleton width="100%" height={theme.sizes.skeletonLine.display} radius={theme.radius.sm} />
          
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>
          
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
          </View>
          
          <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
        </View>
      </BottomSheetModal>
    );
  }

  if (transaction.isError && !isNetworkError(transaction.error)) {
      return (
        <BottomSheetModal
          visible={visible}
          onClose={onClose}
          title={t("transactions.editTransaction")}
        >
          <StateView
            variant="error"
            error={transaction.error}
            retryAction={() => void transaction.refetch()}
            testID="edit-transaction-error"
          />
        </BottomSheetModal>
      );
    }

    const data = transaction.data;
    if (data === undefined) {
      if (isNetworkError(transaction.error)) return null;
      return (
        <BottomSheetModal
          visible={visible}
          onClose={onClose}
          title={t("transactions.editTransaction")}
        >
          <StateView
            variant="error"
            error={transaction.error ?? new Error(t("transactions.unavailable", "Transaction unavailable"))}
            retryAction={() => void transaction.refetch()}
            testID="edit-transaction-missing"
          />
        </BottomSheetModal>
      );
    }

    if (data.status === TransactionStatus.DELETED) {
      return (
        <BottomSheetModal
          visible={visible}
          onClose={onClose}
          title={t("transactions.editTransaction")}
        >
          <View
            className="items-center justify-center"
            style={{ padding: theme.spacing.lg }}
          >
            <Text tone="muted" style={{ textAlign: "center" }}>
              {t("transactions.cancelledNotice", {
                defaultValue:
                  "A deleted transaction cannot be edited. Record a new one instead.",
              })}
            </Text>
          </View>
        </BottomSheetModal>
      );
    }

    const descriptionValue = description ?? data.description ?? "";
    const dayValue = day ?? dayOfInstant(data.transactionDate);
    const categoryValue = categoryId !== undefined ? categoryId : (data.category?.id ?? null);
    const referenceValue = reference ?? data.reference ?? "";
    const categoryWalletId =
      data.fromAccount?.walletId ?? data.toAccount?.walletId;

    async function handleSubmit(current: TransactionResponse) {
      setSubmitError(null);

      const body: UpdateTransactionRequest = {};
      if (descriptionValue !== (current.description ?? "")) {
        body.description = descriptionValue === "" ? null : descriptionValue;
      }
      if (dayValue !== dayOfInstant(current.transactionDate)) {
        body.transactionDate = replaceDay(current.transactionDate, dayValue);
      }
      if (categoryValue !== (current.category?.id ?? null)) {
        body.categoryId = categoryValue;
      }
      if (referenceValue !== (current.reference ?? "")) {
        body.reference = referenceValue === "" ? null : referenceValue;
      }

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      try {
        await updateTransaction({
          transactionId: transactionId as string,
          body,
        }).unwrap();
        onClose();
      } catch (error) {
        setSubmitError(messageOf(error, t));
      }
    }

    async function handleDelete(current: TransactionResponse) {
      setDeleteError(null);
      try {
        await deleteTransaction({ transactionId: current.id }).unwrap();
        setConfirmingDelete(false);
        onClose();
      } catch (error) {
        setDeleteError(messageOf(error, t));
      }
    }

    return (
      <>
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title={t("transactions.editTransaction")}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <Text variant="caption" tone="muted">
            {t("transactions.immutableFieldsNotice", {
              defaultValue:
                "Amount, type and accounts cannot be changed. Delete and re-record to correct those.",
            })}
          </Text>

          <Input
            testID="input-transaction-description"
            label={t("transactions.note", { defaultValue: "Note" })}
            value={descriptionValue}
            onChangeText={setDescription}
          />

          <DateField
            testID="input-transaction-date"
            label={t("transactions.date", { defaultValue: "Date" })}
            value={dayValue}
            onChange={setDay}
          />

          {categoryWalletId !== undefined ? (
            <CategoryPicker
              testID="picker-category"
              walletId={categoryWalletId}
              type={categoryTypeFor(data.type)}
              onClear={data.type === TransactionType.TRANSFER ? () => setCategoryId(null) : undefined}
              value={categoryValue}
              onChange={setCategoryId}
            />
          ) : null}

          <Input
            testID="input-transaction-reference"
            label={t("transactions.reference", { defaultValue: "Reference" })}
            value={referenceValue}
            onChangeText={setReference}
          />

          {submitError !== null ? (
            <Text tone="danger">{submitError}</Text>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Button
              testID="btn-submit-transaction"
              label={t("common.save", { defaultValue: "Save" })}
              icon={Save}
              onPress={() => void handleSubmit(data)}
              loading={isSaving}
              fullWidth
            />
            <Button
              testID="btn-delete-transaction"
              label={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
              icon={Trash2}
              variant="danger-outline"
              onPress={() => setConfirmingDelete(true)}
              fullWidth
            />
          </View>
          {deleteError !== null ? (
            <Text tone="danger" style={{ textAlign: 'center' }}>{deleteError}</Text>
          ) : null}
        </ScrollView>
      </BottomSheetModal>
      
      <ConfirmDialog
        visible={confirmingDelete}
        title={t('transactions.cancelConfirmTitle', { defaultValue: 'Delete this transaction?' })}
        message={t('transactions.cancelConfirmBody', {
          defaultValue: "This removes it from your list and reverses its effect on your balances and budgets. This can't be undone.",
        })}
        confirmLabel={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
        destructive
        loading={isDeleting}
        onConfirm={() => void handleDelete(data)}
        onCancel={() => setConfirmingDelete(false)}
      />
      </>
    );
}
