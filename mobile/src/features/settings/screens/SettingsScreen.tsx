import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedScreen, Button, Card, Text } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import type { MainTabScreenProps } from '@/app/navigation';
import {
  AboutSection,
  AppearanceSection,
  LanguageSection,
  ProfileHeader,
  SettingsBottomActions,
  SettingsDivider,
  SyncSection,
} from '../components';

type SectionKey = 'appearance' | 'language' | 'sync' | 'about';

export function SettingsScreen({ navigation: _navigation }: MainTabScreenProps<'Settings'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    appearance: false,
    language: false,
    sync: false,
    about: false,
  });

  const toggleSection = (id: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <AnimatedScreen>
      <ScrollView
        testID="settings-screen"
        className="flex-1"
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <Card
          testID="settings-profile-card"
          style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }}
        >
          <ProfileHeader />
        </Card>

        <View className="gap-sm">
          <Text
            variant="label"
            weight="bold"
            tone="muted"
            style={{
              paddingHorizontal: theme.spacing.xs,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontSize: 11,
            }}
          >
            {t('settings.title', 'Settings')}
          </Text>

          <Card
            padded={false}
            testID="settings-group"
            style={{
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            }}
          >
            <AppearanceSection
              isOpen={!!openSections.appearance}
              onToggle={() => toggleSection('appearance')}
            />

            <SettingsDivider />

            <LanguageSection
              isOpen={!!openSections.language}
              onToggle={() => toggleSection('language')}
            />

            <SettingsDivider />

            <SyncSection
              isOpen={!!openSections.sync}
              onToggle={() => toggleSection('sync')}
            />

            <SettingsDivider />

            <AboutSection
              isOpen={!!openSections.about}
              onToggle={() => toggleSection('about')}
            />
          </Card>
        </View>

        {__DEV__ ? (
          <Card elevated testID="settings-toast-test" style={{ gap: theme.spacing.sm }}>
            <Button
              testID="settings-test-toast-success"
              label="Test success toast"
              variant="secondary"
              onPress={() => showToast('This is a success toast', 'success')}
              fullWidth
            />
            <Button
              testID="settings-test-toast-error"
              label="Test error toast"
              variant="secondary"
              onPress={() => showToast('This is an error toast', 'error')}
              fullWidth
            />
            <Button
              testID="settings-test-toast-warning"
              label="Test warning toast"
              variant="secondary"
              onPress={() => showToast('This is a warning toast', 'warning')}
              fullWidth
            />
            <Button
              testID="settings-test-toast-info"
              label="Test info toast"
              variant="secondary"
              onPress={() => showToast('This is an info toast', 'info')}
              fullWidth
            />
          </Card>
        ) : null}

        <SettingsBottomActions />
      </ScrollView>
    </AnimatedScreen>
  );
}
