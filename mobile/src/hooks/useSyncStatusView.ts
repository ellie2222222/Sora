import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useAuth, useTheme } from '@/app/providers';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { useNetworkStatus } from './useNetworkStatus.tsx';

/** Connection and sync state, with the titles, details and sync icon colour every sync indicator shows. */
export function useSyncStatusView() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, isSyncing, retrySync } = useNetworkStatus();
  const { isGuest } = useAuth();
  const syncStatus = useSelector(selectSyncStatus);
  const pendingCount = useSelector(selectPendingCount);

  const syncing = syncStatus === 'syncing' || isSyncing;

  const syncIconColor = syncing
    ? theme.colors.primary
    : syncStatus === 'failed'
      ? theme.colors.danger
      : syncStatus === 'pending'
        ? theme.colors.textFaint
        : theme.colors.success;

  const connectionTitle = t(isOnline ? 'errors.connectionOnline' : 'errors.connectionOffline');
  const connectionDetail = t(isOnline ? 'errors.connectionOnlineDetail' : 'errors.connectionOfflineDetail');

  const syncTitle = t(
    syncing
      ? 'errors.syncStatusSyncing'
      : syncStatus === 'failed'
        ? 'errors.syncStatusFailed'
        : syncStatus === 'pending'
          ? 'errors.syncStatusPending'
          : 'errors.syncStatusSynced',
  );
  const syncDetail = t(
    syncing
      ? 'errors.syncDetailSyncing'
      : syncStatus === 'failed'
        ? 'errors.syncDetailFailed'
        : syncStatus === 'pending'
          ? 'errors.syncDetailPending'
          : 'errors.syncDetailSynced',
    { count: pendingCount },
  );

  return {
    isOnline,
    isSyncing,
    retrySync,
    isGuest,
    syncStatus,
    pendingCount,
    syncing,
    syncIconColor,
    connectionTitle,
    connectionDetail,
    syncTitle,
    syncDetail,
  };
}
