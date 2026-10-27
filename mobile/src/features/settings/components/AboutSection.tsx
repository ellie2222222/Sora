import { Info, Shield } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, ThemedIcon } from '@/components';
import { useTheme } from '@/app/providers';
import appConfig from '../../../../app.json';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

// app.json is what the store build is stamped with, so the screen can't drift from the shipped version.
const APP_VERSION = appConfig.expo.version;

export function AboutSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      testID="settings-nav-about"
      icon={<ThemedIcon icon={Info} size={theme.iconSize.lg} color={theme.colors.textMuted} />}
      title={t('settings.about')}
      subtitle={t('settings.aboutSubtitle', { version: APP_VERSION })}
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
          {t('settings.tagline')}
        </Text>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <ThemedIcon icon={Shield} size={theme.iconSize.lg} color={theme.colors.primary} style={{ marginTop: theme.spacing.xxs }} />
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {t('settings.privacyTitle')}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
            {t('settings.privacyDescription')}
          </Text>
        </View>
      </View>

      <SettingsDivider />

      <View className="flex-row justify-between items-center py-xs">
        <Text variant="caption" tone="muted">
          {t('settings.version')}
        </Text>
        <Text weight="medium" style={{ fontSize: theme.fontSize.sm }}>
          {APP_VERSION}
        </Text>
      </View>
    </CollapsibleSection>
  );
}
