import { Info, Shield, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

export function AboutSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const appVersion = '0.1.0';
  const buildNumber = '1';

  return (
    <CollapsibleSection
      testID="settings-nav-about"
      icon={<Info size={20} color={theme.colors.primary} />}
      title={t('settings.about', 'About Sora')}
      subtitle={t('settings.aboutSubtitle', { version: `${appVersion} (${buildNumber})` })}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="items-center py-sm gap-xs">
        <View
          className="w-[52px] h-[52px] rounded-lg items-center justify-center border-[1.5px]"
          style={{
            backgroundColor: theme.colors.primaryMuted,
            borderColor: theme.colors.primary,
          }}
        >
          <Sparkles size={26} color={theme.colors.primary} />
        </View>
        <Text variant="heading" weight="bold" style={{ fontSize: 18 }}>
          Sora
        </Text>
        <Text variant="caption" tone="muted">
          {t('settings.aboutSubtitle', { version: `${appVersion} (${buildNumber})` })}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          style={{ textAlign: 'center', maxWidth: 260, marginTop: 2 }}
        >
          {t('welcomeSubtitle', { defaultValue: 'Track your money simply and privately.' })}
        </Text>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <Shield size={18} color={theme.colors.primary} style={{ marginTop: 2 }} />
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 13 }}>
            {t('settings.privacyTitle', 'Private & Secure')}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {t('settings.privacyDescription')}
          </Text>
        </View>
      </View>

      <SettingsDivider />

      <View className="gap-sm py-xs">
        <View className="flex-row justify-between items-center">
          <Text variant="caption" tone="muted">
            {t('settings.version', 'Version')}
          </Text>
          <Text weight="medium" style={{ fontSize: 13 }}>
            {appVersion}
          </Text>
        </View>
        <SettingsDivider />
        <View className="flex-row justify-between items-center">
          <Text variant="caption" tone="muted">
            {t('settings.build', 'Build')}
          </Text>
          <Text weight="medium" style={{ fontSize: 13 }}>
            {buildNumber}
          </Text>
        </View>
      </View>
    </CollapsibleSection>
  );
}

