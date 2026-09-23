import { Check, Globe } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useLocaleControl, useTheme } from '@/app/providers';
import { SUPPORTED_LOCALES } from '@/app/i18n';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

export function LanguageSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocaleControl();
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressedCode, setPressedCode] = useState<string | null>(null);

  const languageSubtitle = t(`settings.languageNames.${locale}`);

  return (
    <CollapsibleSection
      testID="settings-nav-language"
      icon={<Globe size={18} color={theme.colors.textMuted} />}
      title={t('settings.language', 'Language')}
      subtitle={languageSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="gap-xxs">
        {SUPPORTED_LOCALES.map((code, index) => {
          const isSelected = code === locale;
          return (
            <View key={code}>
              {index > 0 ? <SettingsDivider /> : null}
              <Pressable
                testID={`settings-language-${code}`}
                onPress={() => void setLocale(code)}
                onPressIn={() => setPressedCode(code)}
                onPressOut={() => setPressedCode(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: 12,
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressedCode === code ? theme.colors.surfaceMuted : 'transparent',
                }}
              >
                <Globe
                  size={18}
                  color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  weight={isSelected ? 'bold' : 'regular'}
                  style={{ flex: 1, fontSize: 14 }}
                >
                  {t(`settings.languageNames.${code}`)}
                </Text>
                {isSelected ? (
                  <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </CollapsibleSection>
  );
}

