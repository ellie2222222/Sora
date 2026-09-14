import { Check, Moon, Sun, User } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedScreen, Button, ConfirmDialog, Text, ThemeToggle } from '../../../components';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLocaleControl } from '../../../app/providers/LocaleProvider';
import { useTheme, useThemeControl } from '../../../app/providers/ThemeProvider';
import { PALETTE_RAMPS, THEME_NAMES, type ThemeName } from '../../../design-system';
import { SUPPORTED_LOCALES } from '../../../app/i18n';
import { guestStore } from '../../../services/guest/guestStorage';
import type { MainTabScreenProps } from '../../../app/navigation/types';

export function SettingsScreen(_props: MainTabScreenProps<'Settings'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <AnimatedScreen>
      <ScrollView
        testID="settings-screen"
        // Unlike Home/Account/Goals/Report, this screen has no WalletContextBar to clear the status bar.
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
        }}
      >
        <SettingSection title={t('settings.profile')}>
          <ProfileHeader />
        </SettingSection>

        <SettingSection title={t('settings.appearance')}>
          <ThemePicker />
        </SettingSection>

        <SettingSection title={t('settings.language')}>
          <LanguagePicker />
        </SettingSection>

        <SettingSection title={t('settings.account')}>
          {isGuest ? <GuestAccountSection /> : <SignedInAccountSection />}
        </SettingSection>
      </ScrollView>
    </AnimatedScreen>
  );
}

function ProfileHeader() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest, user } = useAuth();

  const displayName = isGuest
    ? t('guest.settings.guestTitle')
    : user?.displayName || user?.email?.split('@')[0] || t('nav.account');
  const subtitle = isGuest
    ? t('guest.settings.guestSubtitle')
    : user?.email ?? '';

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        {isGuest ? (
          <User size={22} color={theme.colors.primary} />
        ) : (
          <Text weight="bold" style={{ fontSize: 18, color: theme.colors.primary }}>
            {initial}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text weight="bold" style={{ fontSize: 15 }}>
            {displayName}
          </Text>
          {!isGuest ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primaryMuted,
              }}
            >
              <Text style={{ fontSize: 10, color: theme.colors.primary }} weight="semibold">
                {t('settings.activeAccount')}
              </Text>
            </View>
          ) : null}
        </View>

        <Text tone="muted" variant="caption" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function SignedInAccountSection() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  async function handleClearAllData() {
    await guestStore.clear();
    await logout();
  }

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
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
        variant="danger-outline"
        onPress={() => setConfirmingClearAll(true)}
        fullWidth
      />

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
    </View>
  );
}

/**
 * Replaces signed-in-as/logout in guest mode. `exitGuestModeToAuth` keeps the
 * local data rather than discarding it, so registering or signing in from here
 * lands on the upload-resolution screen with everything intact.
 */
function GuestAccountSection() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { exitGuestModeToAuth } = useAuth();
  const [confirmingClear, setConfirmingClear] = useState(false);

  async function clearLocalData() {
    await guestStore.clear();
    await exitGuestModeToAuth();
  }

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Button
        testID="settings-guest-sign-up-or-in"
        label={t('guest.settings.signUpOrIn')}
        onPress={() => void exitGuestModeToAuth()}
        fullWidth
      />

      <Button
        testID="settings-guest-clear"
        label={t('guest.settings.clearData')}
        variant="danger-outline"
        onPress={() => setConfirmingClear(true)}
        fullWidth
      />

      <ConfirmDialog
        visible={confirmingClear}
        title={t('guest.settings.clearConfirmTitle')}
        message={t('guest.settings.clearConfirmBody')}
        confirmLabel={t('guest.settings.clearData')}
        variant="danger"
        matchText={t('guest.settings.clearConfirmMatchWord')}
        onConfirm={() => {
          setConfirmingClear(false);
          void clearLocalData();
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </View>
  );
}

function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Text
        variant="label"
        weight="bold"
        tone="muted"
        style={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: 11,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * One selectable row, shared by theme and language pickers — a clean settings row
 * with subtle row dividers, an optional leading visual (swatch), label, and trailing check.
 */
function SelectionRow({
  testID,
  label,
  selected,
  onPress,
  leading,
  isLast = false,
}: {
  testID?: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  isLast?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      {leading}
      <Text weight={selected ? 'semibold' : 'regular'} style={{ flex: 1, fontSize: 15 }}>
        {label}
      </Text>
      {selected ? <Check size={18} color={theme.colors.primary} strokeWidth={2.5} /> : null}
    </Pressable>
  );
}

function ToggleRow({
  testID,
  label,
  value,
  onValueChange,
  leading,
  isLast = false,
}: {
  testID?: string;
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  leading?: ReactNode;
  isLast?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 10,
        paddingHorizontal: theme.spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      {leading}
      <Text style={{ flex: 1, fontSize: 15 }}>{label}</Text>
      <ThemeToggle
        testID={testID}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function ThemePicker() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeName, themeMode, setThemeName, setThemeMode } = useThemeControl();

  return (
    <View>
      <ToggleRow
        testID="settings-toggle-dark-mode"
        label={themeMode === 'dark' ? t('settings.modes.dark') : t('settings.modes.light')}
        value={themeMode === 'dark'}
        onValueChange={(isDark) => void setThemeMode(isDark ? 'dark' : 'light')}
        leading={
          themeMode === 'dark' ? (
            <Moon size={20} color={theme.colors.primary} strokeWidth={2} />
          ) : (
            <Sun size={20} color={theme.colors.textMuted} strokeWidth={2} />
          )
        }
      />

      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: 4,
          backgroundColor: theme.colors.surfaceMuted,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text variant="caption" weight="bold" tone="muted" style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {t('settings.colorPalette')}
        </Text>
      </View>

      {THEME_NAMES.map((name, index) => (
        <SelectionRow
          key={name}
          testID={`settings-theme-${name}`}
          label={t(`settings.themeNames.${name}`)}
          selected={name === themeName}
          onPress={() => void setThemeName(name)}
          leading={<ThemeSwatch name={name} />}
          isLast={index === THEME_NAMES.length - 1}
        />
      ))}
    </View>
  );
}

function ThemeSwatch({ name }: { name: ThemeName }) {
  const theme = useTheme();
  const ramp = PALETTE_RAMPS[name];

  return (
    <View
      style={{
        width: 28,
        height: 24,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      <View style={{ flex: 1, backgroundColor: ramp[300] }} />
      <View style={{ flex: 1, backgroundColor: ramp[600] }} />
      <View style={{ flex: 1, backgroundColor: ramp[900] }} />
    </View>
  );
}

function LanguagePicker() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocaleControl();

  return (
    <View>
      {SUPPORTED_LOCALES.map((code, index) => (
        <SelectionRow
          key={code}
          testID={`settings-language-${code}`}
          label={t(`settings.languageNames.${code}`)}
          selected={code === locale}
          onPress={() => void setLocale(code)}
          isLast={index === SUPPORTED_LOCALES.length - 1}
        />
      ))}
    </View>
  );
}
