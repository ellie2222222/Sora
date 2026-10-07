import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, CreditCard, Pencil, Tag, Trash2, User, UsersRound, type LucideIcon } from 'lucide-react-native';
import { TransactionStatus, TransactionType, type TransactionResponse } from '@sora/contracts';

import { BottomSheetModal, Button, CategoryAvatar, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { dayOfDate, dayOfInstant, formatDay, formatTimeOfDay } from '@/utils';
import { DeleteTransactionDialog } from './DeleteTransactionDialog.tsx';

export interface TransactionDetailModalProps {
  visible: boolean;
  transaction: TransactionResponse | null;
  onClose: () => void;
  onEdit?: (transaction: TransactionResponse) => void;
}

/**
 * Read-only summary of one transaction. Editing happens in the shared transaction form
 * (`onEdit` opens it in edit mode); this sheet never becomes an editor itself.
 *
 * Hierarchy, top to bottom: title → amount → what the transaction is (category, account,
 * date) → who recorded it and when → actions. The audit group is visually quieter so the
 * transaction reads at a glance before any metadata does.
 */
export function TransactionDetailModal({
  visible,
  transaction,
  onClose,
  onEdit,
}: TransactionDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { permissions, wallets, timeZone: activeTimeZone } = useWallets();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!transaction) return null;

  const category = transaction.category;
  const fromAcc = transaction.fromAccount;
  const toAcc = transaction.toAccount;
  const isTransfer = transaction.type === TransactionType.TRANSFER;
  const homeWalletId = transaction.type === TransactionType.INCOME ? toAcc?.walletId : fromAcc?.walletId;
  const walletTimeZone = wallets.find((wallet) => wallet.id === homeWalletId)?.timeZone ?? activeTimeZone;
  const isDeleted = transaction.status === TransactionStatus.DELETED;
  const isEditable = !isDeleted && permissions.canWrite;

  const title = transaction.description || category?.name || transaction.type;
  const tint = category?.color ?? theme.colors.primary;
  // Income and expense touch one account, so it is simply "Account"; only a transfer has two sides.
  const accountLabel = t('accounts.accountLabel', { defaultValue: 'Account' });

  return (
    <>
    <BottomSheetModal visible={visible} onClose={onClose} title={t('transactions.detailTitle', { defaultValue: 'Transaction details' })}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
      >
        <View className="items-center" style={{ paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          <CategoryAvatar
            categoryIcon={category?.icon}
            categoryName={category?.name}
            transactionType={transaction.type}
            tint={tint}
            size={theme.sizes.badge.md}
          />

          <Text
            variant="title"
            numberOfLines={2}
            style={{ textAlign: 'center', marginTop: theme.spacing.sm }}
            testID="transaction-detail-title"
          >
            {title}
          </Text>

          <Money
            amount={transaction.amount}
            currency={transaction.currency}
            type={transaction.type}
            variant="heading"
            style={{ marginTop: theme.spacing.xxs }}
            testID="transaction-detail-amount"
          />

          {isDeleted ? (
            <View
              style={{
                backgroundColor: theme.colors.dangerMuted,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xxs,
                borderRadius: theme.radius.pill,
                marginTop: theme.spacing.sm,
              }}
            >
              <Text tone="danger" weight="semibold" variant="caption">
                {t('transactions.cancelled', { defaultValue: 'Deleted' })}
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          {category !== null ? (
            <DetailRow
              icon={Tag}
              label={t('categories.categoryLabel', { defaultValue: 'Category' })}
              value={category.name}
              testID="transaction-detail-category"
            />
          ) : null}

          {fromAcc !== null ? (
            <DetailRow
              icon={CreditCard}
              label={isTransfer ? t('transactions.fromLabel', { defaultValue: 'From' }) : accountLabel}
              value={`${fromAcc.name} (${fromAcc.walletName})`}
              testID="transaction-detail-from"
            />
          ) : null}

          {toAcc !== null ? (
            <DetailRow
              icon={CreditCard}
              label={isTransfer ? t('transactions.toLabel', { defaultValue: 'To' }) : accountLabel}
              value={`${toAcc.name} (${toAcc.walletName})`}
              testID="transaction-detail-to"
            />
          ) : null}

          <DetailRow
            icon={Calendar}
            label={t('transactions.transactionDateLabel', { defaultValue: 'Date' })}
            value={formatDay(dayOfInstant(transaction.transactionDate, walletTimeZone))}
            testID="transaction-detail-date"
          />

          {transaction.isCrossWallet ? (
            // A sentence, not a value: it gets the full width instead of a right-aligned column.
            <View className="flex-row" style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
              <UsersRound size={theme.iconSize.md} color={theme.colors.transfer} />
              <Text variant="label" tone="muted" style={{ flex: 1 }}>
                {t('transactions.crossWalletNotice', {
                  defaultValue: "This sends money to another wallet, so it'll show up in their records too.",
                })}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            height: theme.borderWidth.thin,
            backgroundColor: theme.colors.border,
            marginVertical: theme.spacing.sm,
          }}
        />

        <View>
          <DetailRow
            icon={Clock}
            label={t('transactions.createdDateLabel', { defaultValue: 'Created' })}
            value={`${formatDay(dayOfDate(new Date(transaction.createdAt)))} ${formatTimeOfDay(transaction.createdAt)}`}
            secondary
            testID="transaction-detail-created"
          />
          <DetailRow
            icon={User}
            label={t('transactions.recordedByLabel', { defaultValue: 'Added by' })}
            value={transaction.createdBy.displayName}
            secondary
            testID="transaction-detail-recorded-by"
          />
        </View>

        {deleteError !== null ? (
          <Text variant="label" tone="danger" style={{ marginTop: theme.spacing.md }}>
            {deleteError}
          </Text>
        ) : null}

        {isEditable ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            {onEdit ? (
              <Button
                testID="btn-transaction-detail-edit"
                label={t('transactions.editTransaction', { defaultValue: 'Edit transaction' })}
                icon={Pencil}
                variant="secondary"
                onPress={() => {
                  onClose();
                  onEdit(transaction);
                }}
                fullWidth
              />
            ) : null}
            <Button
              testID="btn-transaction-detail-delete"
              label={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
              icon={Trash2}
              variant="danger-outline"
              onPress={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
    <DeleteTransactionDialog
      transaction={confirmingDelete ? transaction : null}
      onCancel={() => setConfirmingDelete(false)}
      onDeleted={() => {
        setConfirmingDelete(false);
        onClose();
      }}
      onError={(message) => {
        setConfirmingDelete(false);
        setDeleteError(message);
      }}
    />
    </>
  );
}

/**
 * One label/value line: icon, muted label on the left, the value right-aligned so a column of
 * values scans top to bottom. A long value wraps to a second line before it truncates; the label
 * is capped so it can never squeeze the value out. `secondary` quiets audit data (created, recorded by).
 */
function DetailRow({
  icon: Icon,
  label,
  value,
  secondary = false,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: boolean;
  testID?: string;
}) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-row items-center"
      style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}
    >
      <Icon size={theme.iconSize.md} color={secondary ? theme.colors.textFaint : theme.colors.textMuted} />
      <Text variant="label" tone="muted" weight="regular" numberOfLines={1} style={{ maxWidth: '45%' }}>
        {label}
      </Text>
      <Text
        variant="label"
        tone={secondary ? 'muted' : 'default'}
        weight={secondary ? 'medium' : 'semibold'}
        numberOfLines={2}
        style={{ flex: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}

