import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedScreen, Card, SectionLabel } from '@/components';
import { useTheme } from '@/app/providers';
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
        testID="screen-settings"
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
          <View style={{ paddingHorizontal: theme.spacing.xs }}>
            <SectionLabel>{t('settings.title', 'Settings')}</SectionLabel>
          </View>

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

        <SettingsBottomActions />
      </ScrollView>
    </AnimatedScreen>
  );
}
