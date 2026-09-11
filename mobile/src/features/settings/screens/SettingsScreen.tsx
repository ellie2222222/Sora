import { Check } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, ConfirmDialog, Text } from '../../../components/index.ts';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useLocaleControl } from '../../../app/providers/LocaleProvider.tsx';
import { useTheme, useThemeControl } from '../../../app/providers/ThemeProvider.tsx';
import { THEME_NAMES, colorsByTheme, type ThemeName } from '../../../design-system/index.ts';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../../app/i18n/index.ts';
import { guestStore } from '../../../services/guest/guestStorage.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function SettingsScreen(_props: MainTabScreenProps<'Settings'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, logout, isGuest } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <ScrollView
      testID="settings-screen"
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
    >
      <Section title={t('settings.appearance')}>
        <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
          {t('settings.theme')}
        </Text>
        <ThemePicker />
      </Section>

      <Section title={t('settings.language')}>
        <LanguagePicker />
      </Section>

      <Section title={t('settings.account')}>
        {isGuest ? (
          <GuestAccountSection />
        ) : (
          <>
            <Text tone="muted" variant="label">
              {t('settings.signedInAs')}
            </Text>
            <Text weight="semibold" style={{ marginBottom: theme.spacing.md }}>
              {user?.email ?? ''}
            </Text>
            <Button
              testID="settings-logout"
              label={t('settings.logout')}
              variant="danger"
              onPress={() => setConfirmingLogout(true)}
            />
          </>
        )}
      </Section>

      <ConfirmDialog
        visible={confirmingLogout}
        title={t('settings.logoutConfirmTitle')}
        message={t('settings.logoutConfirmBody')}
        confirmLabel={t('settings.logout')}
        destructive
        onConfirm={() => {
          setConfirmingLogout(false);
          void logout();
        }}
        onCancel={() => setConfirmingLogout(false)}
      />
    </ScrollView>
  );
}

/**
 * Replaces signed-in-as/logout in guest mode. `exitGuestModeToAuth` keeps the
 * local data rather than discarding it, so registering or signing in from here
 * lands on the upload-resolution screen with everything intact; "clear local
 * data" is the only path that actually destroys it, behind a confirmation
 * because nothing in guest mode is recoverable from a server.
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
    <View style={{ gap: theme.spacing.md }}>
      <Text tone="muted">{t('guest.settings.banner')}</Text>
      <Text variant="caption" tone="faint">
        {t('guest.settings.keepDataNote')}
      </Text>

      {/* One CTA, not separate register/login buttons: both would run the same
          `exitGuestModeToAuth`, and the auth stack opens on Login, which already
          links to Register. */}
      <Button
        testID="settings-guest-sign-up-or-in"
        label={t('guest.settings.signUpOrIn')}
        onPress={() => void exitGuestModeToAuth()}
        fullWidth
      />
      <Button
        testID="settings-guest-clear"
        label={t('guest.settings.clearData')}
        variant="danger"
        onPress={() => setConfirmingClear(true)}
        fullWidth
      />

      <ConfirmDialog
        visible={confirmingClear}
        title={t('guest.settings.clearConfirmTitle')}
        message={t('guest.settings.clearConfirmBody')}
        confirmLabel={t('guest.settings.clearData')}
        destructive
        onConfirm={() => {
          setConfirmingClear(false);
          void clearLocalData();
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

function ThemePicker() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { themeName, setThemeName } = useThemeControl();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {THEME_NAMES.map((name) => (
        <ThemeRow
          key={name}
          name={name}
          label={t(`settings.themeNames.${name}`)}
          selected={name === themeName}
          onPress={() => void setThemeName(name)}
        />
      ))}
    </View>
  );
}

function ThemeRow({
  name,
  label,
  selected,
  onPress,
}: {
  name: ThemeName;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const swatch = colorsByTheme[name];

  return (
    <Pressable
      testID={`settings-theme-${name}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: theme.radius.sm,
          backgroundColor: swatch.background,
          borderWidth: 1,
          borderColor: swatch.border,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1, backgroundColor: swatch.primary }} />
        <View style={{ flex: 1, backgroundColor: swatch.surface }} />
      </View>
      <Text weight={selected ? 'semibold' : 'regular'} style={{ flex: 1 }}>
        {label}
      </Text>
      {selected ? <Check size={18} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}

function LanguagePicker() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocaleControl();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {SUPPORTED_LOCALES.map((code) => (
        <LanguageRow
          key={code}
          code={code}
          label={t(`settings.languageNames.${code}`)}
          selected={code === locale}
          onPress={() => void setLocale(code)}
        />
      ))}
    </View>
  );
}

function LanguageRow({
  code,
  label,
  selected,
  onPress,
}: {
  code: SupportedLocale;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={`settings-language-${code}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <Text weight={selected ? 'semibold' : 'regular'} style={{ flex: 1 }}>
        {label}
      </Text>
      {selected ? <Check size={18} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}
