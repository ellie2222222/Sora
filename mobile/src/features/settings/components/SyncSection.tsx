import { Clock, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AnimatedIcon, Button, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useSyncStatusView } from '@/hooks';
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
  const {
    isOnline,
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
  } = useSyncStatusView();

  const handleManualSync = () => {
    if (syncing || !isOnline || isGuest) return;
    void retrySync();
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

  return (
    <CollapsibleSection
      testID="settings-nav-sync"
      icon={<RefreshCw size={theme.iconSize.lg} color={theme.colors.textMuted} />}
      title={t('settings.sync', 'Sync & Storage')}
      subtitle={syncSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {isOnline ? (
            <Wifi size={theme.iconSize.lg} color={theme.colors.success} />
          ) : (
            <WifiOff size={theme.iconSize.lg} color={theme.colors.warning} />
          )}
        </View>
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {connectionTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
            {connectionDetail}
          </Text>
        </View>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {syncing ? (
            <AnimatedIcon icon={RefreshCw} size={theme.iconSize.lg} color={syncIconColor} animation="spin" />
          ) : syncStatus === 'failed' ? (
            <TriangleAlert size={theme.iconSize.lg} color={syncIconColor} />
          ) : syncStatus === 'pending' ? (
            <Clock size={theme.iconSize.lg} color={syncIconColor} />
          ) : (
            <RefreshCw size={theme.iconSize.lg} color={syncIconColor} />
          )}
        </View>

        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {syncTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
            {syncDetail}
          </Text>
        </View>
      </View>

      {!isGuest && isOnline ? (
        <Button
          testID="sync-settings-sync-now"
          label={t('errors.syncNowAction', 'Sync now')}
          icon={RefreshCw}
          variant="secondary"
          size="sm"
          loading={syncing}
          onPress={handleManualSync}
          fullWidth
        />
      ) : null}
    </CollapsibleSection>
  );
}

