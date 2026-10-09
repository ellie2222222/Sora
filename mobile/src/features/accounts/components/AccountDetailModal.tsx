import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, ChevronRight, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { AccountStatus, type MoneyString } from '@sora/contracts';

import { BottomSheetModal, Money, Skeleton, StateView, Text } from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
import { useGetAccountQuery } from '@/app/store';
import { isNetworkError, permissionsForWallet } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';
import { AccountEditForm } from './AccountEditForm.tsx';
import { ArchiveAccountDialog } from './ArchiveAccountDialog.tsx';

export interface AccountDetailModalProps {
  accountId: string | null;
  onClose: () => void;
  /** The list is another tab, so the host closes this sheet as it goes there; `walletId` may not be the active one. */
  onViewTransactions: (account: { accountId: string; walletId: string }) => void;
}

export function AccountDetailModal({ accountId, onClose, onViewTransactions }: AccountDetailModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { wallets } = useWallets();
  const { showToast } = useToast();
  const [archiving, setArchiving] = useState(false);
  const [linkPressed, setLinkPressed] = useState(false);

  const account = useGetAccountQuery(accountId as string, { skip: accountId === null });

  const renderContent = () => {
    if (account.isLoading) return <AccountDetailSkeleton />;
    if (account.isError) {
      return isNetworkError(account.error) ? (
        <StateView variant="error" title={t('errors.offlineTitle')} message={t('errors.connectionOfflineDetail')} entrance="none" />
      ) : (
        <StateView variant="error" title={t('common.error')} message={t('accounts.loadFailed')} retryAction={() => void account.refetch()} entrance="none" />
      );
    }

    const data = account.data;
    if (data === undefined) return null;
    if (data.status === AccountStatus.ARCHIVED) {
      return <StateView variant="empty" title={t('accounts.archivedTitle')} message={t('accounts.archivedMessage')} entrance="none" />;
    }
    // The account's own wallet decides, not the active one: this sheet opens from any wallet's page.
    const canWrite = permissionsForWallet(wallets, data.walletId).canWrite;
    const TypeIcon = ACCOUNT_ICON[data.type];

    return (
      <>
        <View className="items-center" style={{ paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          <View
            className="items-center justify-center"
            style={{ width: theme.sizes.badge.md, height: theme.sizes.badge.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primaryMuted }}
          >
            <TypeIcon size={theme.iconSize.lg} color={theme.colors.primary} />
          </View>
          <Text variant="title" numberOfLines={2} style={{ textAlign: 'center', marginTop: theme.spacing.sm }} testID="account-detail-name">
            {data.name}
          </Text>
          <Money amount={data.balance} currency={data.currency} variant="heading" style={{ marginTop: theme.spacing.xxs }} testID="account-detail-balance" />
          <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xxs }}>
            {t(ACCOUNT_TYPE_LABEL_KEY[data.type])} · {data.currency}
          </Text>
        </View>

        <View>
          <FigureRow icon={ArrowDownLeft} label={t('dashboard.income')} amount={data.totalIncome} currency={data.currency} type="INCOME" />
          <FigureRow icon={ArrowUpRight} label={t('dashboard.expenses')} amount={data.totalExpense} currency={data.currency} type="EXPENSE" />
          <FigureRow icon={ArrowDownToLine} label={t('accounts.transferredIn')} amount={data.transferredIn} currency={data.currency} />
          <FigureRow icon={ArrowUpFromLine} label={t('accounts.transferredOut')} amount={data.transferredOut} currency={data.currency} />
        </View>

        <Pressable
          testID="btn-view-account-transactions"
          accessibilityRole="button"
          onPress={() => {
            // The sheet closes under the finger, so no press-out arrives to clear this.
            setLinkPressed(false);
            onViewTransactions({ accountId: data.id, walletId: data.walletId });
          }}
          onPressIn={() => setLinkPressed(true)}
          onPressOut={() => setLinkPressed(false)}
          className="flex-row items-center"
          style={{
            gap: theme.spacing.md,
            marginTop: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: linkPressed ? theme.colors.surfacePressed : theme.colors.primaryMuted,
          }}
        >
          <ReceiptText size={theme.iconSize.md} color={theme.colors.primary} />
          <Text weight="medium" style={{ flex: 1, color: theme.colors.primary }}>
            {t('accounts.viewTransactions', { count: data.transactionCount })}
          </Text>
          <ChevronRight size={theme.iconSize.md} color={theme.colors.primary} />
        </Pressable>

        {canWrite ? (
          <>
            <View style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg }} />
            <AccountEditForm key={data.id} account={data} onArchive={() => setArchiving(true)} />
          </>
        ) : null}
      </>
    );
  };

  return (
    <BottomSheetModal visible={accountId !== null} onClose={onClose} title={t('accounts.detailTitle')} testID="account-detail-modal">
      {/* Scrolls so Save stays reachable above the keyboard while renaming. */}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
        {renderContent()}
      </ScrollView>
      <ArchiveAccountDialog
        accountId={archiving ? accountId : null}
        onCancel={() => setArchiving(false)}
        onArchived={() => {
          setArchiving(false);
          onClose();
        }}
        onError={(message) => {
          setArchiving(false);
          showToast(message, 'error');
        }}
      />
    </BottomSheetModal>
  );
}

/** One figure line, laid out like the transaction sheet's detail rows so the two sheets read alike. */
function FigureRow({
  icon: Icon,
  label,
  amount,
  currency,
  type,
}: {
  icon: LucideIcon;
  label: string;
  amount: MoneyString;
  currency: string;
  type?: 'INCOME' | 'EXPENSE';
}) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center" style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
      <Icon size={theme.iconSize.md} color={theme.colors.textMuted} />
      <Text variant="label" tone="muted" weight="regular" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Money amount={amount} currency={currency} type={type} variant="label" weight="semibold" />
    </View>
  );
}

function AccountDetailSkeleton() {
  const theme = useTheme();
  return (
    <>
      <View className="items-center" style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
        <Skeleton width={theme.sizes.badge.md} height={theme.sizes.badge.md} radius={theme.radius.pill} />
        <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.title} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
      </View>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} className="flex-row items-center" style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
          <Skeleton width={theme.iconSize.md} height={theme.iconSize.md} radius={theme.radius.sm} />
          <View style={{ flex: 1 }}>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
          </View>
          <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
        </View>
      ))}
    </>
  );
}
