import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Database, LogOut, Trash2, LogIn } from 'lucide-react-native';
import { Button, ConfirmDialog } from '@/components';
import { env } from '@/app/config';
import { useAuth, useToast } from '@/app/providers';
import { invalidateEverything, useAppDispatch } from '@/app/store';
import { guestStore, loadGuestFixture } from '@/services/guest';

const demoFixtureUrl = __DEV__ ? env.demoFixtureUrl : undefined;

export function SettingsBottomActions() {
  const { t } = useTranslation();
  const { isGuest, logout, exitGuestModeToAuth } = useAuth();
  const { showToast } = useToast();
  const dispatch = useAppDispatch();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [confirmingGuestClear, setConfirmingGuestClear] = useState(false);
  const [confirmingLoadDemo, setConfirmingLoadDemo] = useState(false);

  async function handleClearAllData() {
    await guestStore.clear();
    await logout();
  }

  async function handleClearGuestData() {
    await guestStore.clear();
    await exitGuestModeToAuth();
  }

  async function handleLoadDemo(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadGuestFixture(await response.json());
      dispatch(invalidateEverything());
      showToast(t('guest.settings.loadDemoDone'), 'success');
    } catch {
      showToast(t('guest.settings.loadDemoFailed'), 'error');
    }
  }

  return (
    <>
      <View className="gap-sm mt-md">
        {!isGuest ? (
          <>
            <Button
              testID="btn-logout"
              label={t('settings.logout')}
              icon={LogOut}
              variant="secondary"
              onPress={() => setConfirmingLogout(true)}
              fullWidth
            />
            <Button
              testID="settings-clear-all"
              label={t('settings.clearAllData')}
              icon={Trash2}
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
              icon={LogIn}
              variant="primary"
              onPress={() => void exitGuestModeToAuth()}
              fullWidth
            />
            {demoFixtureUrl ? (
              <Button
                testID="settings-guest-load-demo"
                label={t('guest.settings.loadDemo')}
                icon={Database}
                variant="secondary"
                onPress={() => setConfirmingLoadDemo(true)}
                fullWidth
              />
            ) : null}
            <Button
              testID="settings-guest-clear"
              label={t('guest.settings.clearData')}
              icon={Trash2}
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

      {demoFixtureUrl ? (
        <ConfirmDialog
          visible={confirmingLoadDemo}
          title={t('guest.settings.loadDemoConfirmTitle')}
          message={t('guest.settings.loadDemoConfirmBody')}
          confirmLabel={t('guest.settings.loadDemo')}
          variant="danger"
          onConfirm={() => {
            setConfirmingLoadDemo(false);
            void handleLoadDemo(demoFixtureUrl);
          }}
          onCancel={() => setConfirmingLoadDemo(false)}
        />
      ) : null}
    </>
  );
}

