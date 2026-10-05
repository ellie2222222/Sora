import { Info, Shield } from 'lucide-react-native';
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
      icon={<Info size={theme.iconSize.lg} color={theme.colors.textMuted} />}
      title={t('settings.about', 'About Sora')}
      subtitle={t('settings.aboutSubtitle', { version: `${appVersion} (${buildNumber})` })}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="items-center py-sm gap-xs">
        <Text variant="heading" weight="bold" style={{ fontSize: theme.fontSize.xl }}>
          Sora
        </Text>
        <Text
          variant="caption"
          tone="muted"
          style={{ textAlign: 'center', maxWidth: theme.sizes.readableWidth }}
        >
          {t('welcomeSubtitle', { defaultValue: 'Track your money simply and privately.' })}
        </Text>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <Shield size={theme.iconSize.lg} color={theme.colors.primary} style={{ marginTop: theme.spacing.xxs }} />
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {t('settings.privacyTitle', 'Private & Secure')}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
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
          <Text weight="medium" style={{ fontSize: theme.fontSize.sm }}>
            {appVersion}
          </Text>
        </View>
        <SettingsDivider />
        <View className="flex-row justify-between items-center">
          <Text variant="caption" tone="muted">
            {t('settings.build', 'Build')}
          </Text>
          <Text weight="medium" style={{ fontSize: theme.fontSize.sm }}>
            {buildNumber}
          </Text>
        </View>
      </View>
    </CollapsibleSection>
  );
}

