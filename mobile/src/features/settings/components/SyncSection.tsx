import { Clock, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { AnimatedIcon, Button, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

export function SyncSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, isSyncing: networkSyncing, retrySync } = useNetworkStatus();
  const { isGuest } = useAuth();
  const syncStatus = useSelector(selectSyncStatus);
  const pendingCount = useSelector(selectPendingCount);
  const [manualSyncing, setManualSyncing] = useState(false);

  const syncing = syncStatus === 'syncing' || networkSyncing || manualSyncing;

  const syncIconColor = syncing
    ? theme.colors.primary
    : syncStatus === 'failed'
      ? theme.colors.danger
      : syncStatus === 'pending'
        ? theme.colors.textFaint
        : theme.colors.success;

  const handleManualSync = async () => {
    if (syncing || !isOnline || isGuest) return;
    setManualSyncing(true);
    try {
      await retrySync();
    } finally {
      setManualSyncing(false);
    }
  };

  const syncSubtitle = syncing
    ? t('errors.syncStatusSyncing')
    : syncStatus === 'failed'
      ? t('errors.syncStatusFailed')
      : pendingCount > 0
        ? t('errors.syncDetailPending', { count: pendingCount })
        : isOnline
          ? t('errors.syncStatusSynced')
          : t('errors.connectionOffline');

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

  return (
    <CollapsibleSection
      testID="settings-nav-sync"
      icon={<RefreshCw size={18} color={theme.colors.textMuted} />}
      title={t('settings.sync', 'Sync & Storage')}
      subtitle={syncSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {isOnline ? (
            <Wifi size={18} color={theme.colors.success} />
          ) : (
            <WifiOff size={18} color={theme.colors.warning} />
          )}
        </View>
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {connectionTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {connectionDetail}
          </Text>
        </View>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {syncing ? (
            <AnimatedIcon icon={RefreshCw} size={18} color={syncIconColor} animation="spin" />
          ) : syncStatus === 'failed' ? (
            <TriangleAlert size={18} color={syncIconColor} />
          ) : syncStatus === 'pending' ? (
            <Clock size={18} color={syncIconColor} />
          ) : (
            <RefreshCw size={18} color={syncIconColor} />
          )}
        </View>

        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {syncTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {syncDetail}
          </Text>
        </View>
      </View>

      {!isGuest && isOnline ? (
        <Button
          testID="sync-settings-sync-now"
          label={t('errors.syncNowAction', 'Sync now')}
          variant="secondary"
          size="sm"
          loading={syncing}
          onPress={() => void handleManualSync()}
          fullWidth
        />
      ) : null}
    </CollapsibleSection>
  );
}

