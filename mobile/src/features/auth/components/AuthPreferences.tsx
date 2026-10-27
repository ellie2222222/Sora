import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BottomSheetModal, Text, ThemedIcon, ThemedPressable, ThemeToggle } from '@/components';
import { useLocaleControl, useTheme, useThemeControl } from '@/app/providers';
import { LanguageFlag, LanguageOptions } from '@/features/settings';

/** Language and light/dark before signing in, so someone can read the form in their own language first. */
export function AuthPreferences() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { locale } = useLocaleControl();
  const { themeMode, setThemeMode } = useThemeControl();
  const [pickingLanguage, setPickingLanguage] = useState(false);
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [languagePressed, setLanguagePressed] = useState(false);

  return (
    <>
      <View
        className="flex-row items-center justify-between"
        style={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.xl }}
      >
        <ThemedPressable
          testID="btn-auth-language"
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.language')}: ${t(`settings.languageNames.${locale}`)}`}
          onPress={() => setPickingLanguage(true)}
          onPressIn={() => setLanguagePressed(true)}
          onPressOut={() => setLanguagePressed(false)}
          hitSlop={theme.sizes.hitSlop.md}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border,
            backgroundColor: languagePressed ? theme.colors.surfaceMuted : theme.colors.surface,
          }}
        >
          <LanguageFlag locale={locale} />
          <Text variant="label" weight="semibold">
            {t(`settings.languageNames.${locale}`)}
          </Text>
          <ThemedIcon icon={ChevronDown} size={theme.iconSize.sm} color={theme.colors.textMuted} />
        </ThemedPressable>

        <ThemeToggle
          testID="toggle-auth-theme"
          size="sm"
          value={themeMode === 'dark'}
          onValueChange={(isDark) => void setThemeMode(isDark ? 'dark' : 'light')}
        />
      </View>

      <BottomSheetModal
        visible={pickingLanguage}
        onClose={() => setPickingLanguage(false)}
        title={t('settings.language')}
        entity="language"
      >
        <LanguageOptions testIDPrefix="option-language" onSelected={() => setPickingLanguage(false)} />
      </BottomSheetModal>
    </>
  );
}
