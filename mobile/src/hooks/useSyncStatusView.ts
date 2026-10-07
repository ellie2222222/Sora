import { Cloud, CloudOff, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useAuth, useTheme } from '@/app/providers';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { useNetworkStatus, type ServerStatus } from './useNetworkStatus.tsx';

export type ConnectionState = 'offline' | ServerStatus;

const CONNECTION_ICON: Record<ConnectionState, LucideIcon> = {
  offline: WifiOff,
  checking: Cloud,
  connected: Cloud,
  unreachable: CloudOff,
};

const CONNECTION_COPY: Record<ConnectionState, { title: string; detail: string }> = {
  offline: { title: 'errors.connectionOffline', detail: 'errors.connectionOfflineDetail' },
  checking: { title: 'errors.connectionChecking', detail: 'errors.connectionCheckingDetail' },
  connected: { title: 'errors.connectionConnected', detail: 'errors.connectionConnectedDetail' },
  unreachable: { title: 'errors.connectionUnreachable', detail: 'errors.connectionUnreachableDetail' },
};

/** Connection and sync state, with the titles, details and sync icon colour every sync indicator shows. */
export function useSyncStatusView() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, serverStatus, checkServer, isSyncing, retrySync } = useNetworkStatus();
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

  const connectionState: ConnectionState = isOnline ? serverStatus : 'offline';
  const connectionTitle = t(CONNECTION_COPY[connectionState].title);
  const connectionDetail = t(CONNECTION_COPY[connectionState].detail);
  const ConnectionIcon = CONNECTION_ICON[connectionState];
  const connectionIconColor =
    connectionState === 'connected'
      ? theme.colors.success
      : connectionState === 'checking'
        ? theme.colors.textFaint
        : theme.colors.warning;

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
    connectionState,
    checkServer,
    isSyncing,
    retrySync,
    isGuest,
    syncStatus,
    pendingCount,
    syncing,
    syncIconColor,
    connectionTitle,
    connectionDetail,
    ConnectionIcon,
    connectionIconColor,
    syncTitle,
    syncDetail,
  };
}
