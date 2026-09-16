import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog } from '@/components';
import { useAuth } from '@/app/providers';
import { guestStore } from '@/services/guest';

export function SettingsBottomActions() {
  const { t } = useTranslation();
  const { isGuest, logout, exitGuestModeToAuth } = useAuth();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [confirmingGuestClear, setConfirmingGuestClear] = useState(false);

  async function handleClearAllData() {
    await guestStore.clear();
    await logout();
  }

  async function handleClearGuestData() {
    await guestStore.clear();
    await exitGuestModeToAuth();
  }

  return (
    <>
      <View className="gap-sm mt-md">
        {!isGuest ? (
          <>
            <Button
              testID="settings-logout"
              label={t('settings.logout')}
              variant="secondary"
              onPress={() => setConfirmingLogout(true)}
              fullWidth
            />
            <Button
              testID="settings-clear-all"
              label={t('settings.clearAllData')}
              variant="danger-soft"
              onPress={() => setConfirmingClearAll(true)}
              fullWidth
            />
          </>
        ) : (
          <>
            <Button
              testID="settings-guest-sign-up-or-in"
              label={t('guest.settings.signUpOrIn')}
              variant="primary"
              onPress={() => void exitGuestModeToAuth()}
              fullWidth
            />
            <Button
              testID="settings-guest-clear"
              label={t('guest.settings.clearData')}
              variant="danger-soft"
              onPress={() => setConfirmingGuestClear(true)}
              fullWidth
            />
          </>
        )}
      </View>

      <ConfirmDialog
        visible={confirmingLogout}
        title={t('settings.logoutConfirmTitle')}
        message={t('settings.logoutConfirmBody')}
        confirmLabel={t('settings.logout')}
        variant="danger"
        onConfirm={() => {
          setConfirmingLogout(false);
          void logout();
        }}
        onCancel={() => setConfirmingLogout(false)}
      />

      <ConfirmDialog
        visible={confirmingClearAll}
        title={t('settings.clearAllConfirmTitle')}
        message={t('settings.clearAllConfirmBody')}
        confirmLabel={t('settings.clearAllData')}
        variant="danger"
        onConfirm={() => {
          setConfirmingClearAll(false);
          void handleClearAllData();
        }}
        onCancel={() => setConfirmingClearAll(false)}
      />

      <ConfirmDialog
        visible={confirmingGuestClear}
        title={t('guest.settings.clearConfirmTitle')}
        message={t('guest.settings.clearConfirmBody')}
        confirmLabel={t('guest.settings.clearData')}
        variant="danger"
        matchText={t('guest.settings.clearConfirmMatchWord')}
        onConfirm={() => {
          setConfirmingGuestClear(false);
          void handleClearGuestData();
        }}
        onCancel={() => setConfirmingGuestClear(false)}
      />
    </>
  );
}

