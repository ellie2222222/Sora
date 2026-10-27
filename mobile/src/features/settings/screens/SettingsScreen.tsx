import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedScreen, Card, SectionLabel, ThemedScrollView } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import type { MainTabScreenProps } from '@/app/navigation';
import {
  AboutSection,
  AppearanceSection,
  InvitationsSection,
  LanguageSection,
  ProfileHeader,
  SettingsBottomActions,
  SettingsDivider,
  SyncSection,
} from '../components';

type SectionKey = 'invitations' | 'appearance' | 'language' | 'sync' | 'about';

export function SettingsScreen({ navigation: _navigation }: MainTabScreenProps<'Settings'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    invitations: false,
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
      <ThemedScrollView
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
          style={{ borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border }}
        >
          <ProfileHeader />
        </Card>

        <View className="gap-sm">
          <View style={{ paddingHorizontal: theme.spacing.xs }}>
            <SectionLabel>{t('settings.title')}</SectionLabel>
          </View>

          <Card
            padded={false}
            testID="settings-group"
            style={{
              overflow: 'hidden',
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border,
            }}
          >
            {/* A guest has no email, so nothing can be addressed to them. */}
            {isGuest ? null : (
              <>
                <InvitationsSection
                  isOpen={!!openSections.invitations}
                  onToggle={() => toggleSection('invitations')}
                />

                <SettingsDivider />
              </>
            )}

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
      </ThemedScrollView>
    </AnimatedScreen>
  );
}
