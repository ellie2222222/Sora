import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccountStatus } from '@sora/contracts';

import { Card, Money, Skeleton, StateView, Text } from '@/components';
import { useTheme, useToast, useWallets } from '@/app/providers';
import { useGetAccountQuery } from '@/app/store';
import { isNetworkError, permissionsForWallet } from '@/utils';
import type { AppStackScreenProps } from '@/app/navigation';
import { AccountEditCard } from '../components/AccountEditCard.tsx';
import { ArchiveAccountDialog } from '../components/ArchiveAccountDialog.tsx';

function AccountDetailSkeleton() {
  const theme = useTheme();
  return (
    <>
      <Card>
        <Skeleton width="40%" height={theme.sizes.skeletonLine.title} />
        <View style={{ marginTop: theme.spacing.xs }}>
          <Skeleton width="60%" height={theme.sizes.skeletonLine.display} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={theme.sizes.skeletonLine.label} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="80%" height={theme.sizes.skeletonLine.title} />
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={theme.sizes.skeletonLine.label} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="80%" height={theme.sizes.skeletonLine.title} />
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={theme.sizes.skeletonLine.label} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="70%" height={theme.sizes.skeletonLine.body} />
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <Skeleton width="50%" height={theme.sizes.skeletonLine.label} />
          <View style={{ marginTop: theme.spacing.xs }}>
            <Skeleton width="70%" height={theme.sizes.skeletonLine.body} />
          </View>
        </Card>
      </View>

      <Skeleton width="40%" height={theme.sizes.skeletonLine.body} />
    </>
  );
}

export function AccountDetailScreen({ route, navigation }: AppStackScreenProps<'AccountDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { accountId } = route.params;
  const { wallets } = useWallets();
  const { showToast } = useToast();
  const [archiving, setArchiving] = useState(false);

  const account = useGetAccountQuery(accountId);

  if (account.isLoading) {
    return (
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <AccountDetailSkeleton />
      </ScrollView>
    );
  }
  
  if (account.isError) {
    if (isNetworkError(account.error)) {
      return (
        <StateView 
          variant="error" 
          title={t('errors.offlineTitle', { defaultValue: 'Offline' })} 
          message={t('errors.connectionOfflineDetail', { defaultValue: 'Check your connection.' })} 
        />
      );
    }
    return (
      <StateView 
        variant="error" 
        title={t('common.error', { defaultValue: 'Error' })} 
        message={t('errors.internalError', { defaultValue: 'Could not load account details.' })} 
      />
    );
  }

  const data = account.data;
  if (data === undefined) return null;
  // The account's own wallet decides, not the active one: this screen opens from any wallet's sheet.
  const canWrite = permissionsForWallet(wallets, data.walletId).canWrite;

  const renderContent = () => {
    if (data.status === AccountStatus.ARCHIVED) {
      return (
        <StateView
          variant="empty"
          title={t('common.archived', { defaultValue: 'Account Archived' })}
          message={t('errors.accountArchived', { defaultValue: 'This account has been archived and its history is frozen.' })}
        />
      );
    }

    return (
      <>
        <Card>
          <Text variant="title">{data.name}</Text>
          <Money amount={data.balance} currency={data.currency} variant="heading" style={{ marginTop: theme.spacing.xs }} />
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('dashboard.income')}
            </Text>
            <Money amount={data.totalIncome} currency={data.currency} type="INCOME" variant="title" />
          </Card>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('dashboard.expenses')}
            </Text>
            <Money amount={data.totalExpense} currency={data.currency} type="EXPENSE" variant="title" />
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('accounts.transferredIn')}
            </Text>
            <Money amount={data.transferredIn} currency={data.currency} variant="body" />
          </Card>
          <Card style={{ flex: 1 }}>
            <Text variant="label" tone="muted">
              {t('accounts.transferredOut')}
            </Text>
            <Money amount={data.transferredOut} currency={data.currency} variant="body" />
          </Card>
        </View>

        <Text
          tone="muted"
          onPress={() => navigation.navigate('Transactions', { accountId })}
        >
          {t('accounts.viewTransactions', { count: data.transactionCount, defaultValue: `View ${data.transactionCount} transactions ->` })}
        </Text>

        {canWrite ? <AccountEditCard key={data.id} account={data} onArchive={() => setArchiving(true)} /> : null}
      </>
    );
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        {renderContent()}
      </ScrollView>
      <ArchiveAccountDialog
        accountId={archiving ? accountId : null}
        onCancel={() => setArchiving(false)}
        onArchived={() => {
          setArchiving(false);
          navigation.goBack();
        }}
        onError={(message) => {
          setArchiving(false);
          showToast(message, 'error');
        }}
      />
    </>
  );
}

