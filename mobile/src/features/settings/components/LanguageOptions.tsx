import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, ThemedIcon, ThemedPressable } from '@/components';
import { useLocaleControl, useTheme } from '@/app/providers';
import { SUPPORTED_LOCALES } from '@/app/i18n';
import { SettingsDivider } from './CollapsibleSection';
import { LanguageFlag } from './LanguageFlag';

/** Every supported language as a radio list; Settings and the sign-in screens' picker share it. */
export function LanguageOptions({ testIDPrefix, onSelected }: { testIDPrefix: string; onSelected?: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocaleControl();
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressedCode, setPressedCode] = useState<string | null>(null);

  return (
    <View className="gap-xxs">
      {SUPPORTED_LOCALES.map((code, index) => {
        const isSelected = code === locale;
        return (
          <View key={code}>
            {index > 0 ? <SettingsDivider /> : null}
            <ThemedPressable
              testID={`${testIDPrefix}-${code}`}
              onPress={() => {
                void setLocale(code);
                onSelected?.();
              }}
              onPressIn={() => setPressedCode(code)}
              onPressOut={() => setPressedCode(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: theme.sizes.touchTarget,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.xs,
                borderRadius: theme.radius.sm,
                backgroundColor: pressedCode === code ? theme.colors.surfaceMuted : 'transparent',
              }}
            >
              <LanguageFlag locale={code} />
              <Text weight={isSelected ? 'bold' : 'regular'} style={{ flex: 1, fontSize: theme.fontSize.sm }}>
                {t(`settings.languageNames.${code}`)}
              </Text>
              {isSelected ? (
                <ThemedIcon icon={Check} size={theme.iconSize.lg} color={theme.colors.primary} strokeWidth={theme.iconStroke.bold} />
              ) : null}
            </ThemedPressable>
          </View>
        );
      })}
    </View>
  );
}
