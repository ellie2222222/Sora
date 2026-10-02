import { Check, Moon, Palette, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, ThemeToggle } from '@/components';
import { useTheme, useThemeControl } from '@/app/providers';
import { PALETTE_RAMPS, THEME_NAMES, type ThemeName } from '../../../design-system';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

function ThemeSwatch({ name }: { name: ThemeName }) {
  const theme = useTheme();
  const ramp = PALETTE_RAMPS[name];

  return (
    <View
      className="w-[32px] h-[24px] rounded-sm border overflow-hidden flex-row"
      style={{ borderColor: theme.colors.border }}
    >
      <View className="flex-1" style={{ backgroundColor: ramp[300] }} />
      <View className="flex-1" style={{ backgroundColor: ramp[600] }} />
      <View className="flex-1" style={{ backgroundColor: ramp[900] }} />
    </View>
  );
}

export function AppearanceSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { themeName, themeMode, setThemeName, setThemeMode } = useThemeControl();
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressedName, setPressedName] = useState<ThemeName | null>(null);
  const [modeRowPressed, setModeRowPressed] = useState(false);

  const appearanceSubtitle = `${themeMode === 'dark' ? t('settings.modes.dark') : t('settings.modes.light')} · ${t(`settings.themeNames.${themeName}`)}`;

  return (
    <CollapsibleSection
      testID="settings-nav-appearance"
      icon={<Palette size={18} color={theme.colors.textMuted} />}
      title={t('settings.appearance', 'Appearance')}
      subtitle={appearanceSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <Pressable
        testID="settings-row-dark-mode"
        onPress={() => void setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        onPressIn={() => setModeRowPressed(true)}
        onPressOut={() => setModeRowPressed(false)}
        accessibilityRole="switch"
        accessibilityState={{ checked: themeMode === 'dark' }}
        className="flex-row items-center gap-md py-xs"
        style={{
          borderRadius: theme.radius.sm,
          backgroundColor: modeRowPressed ? theme.colors.surfaceMuted : 'transparent',
        }}
      >
        {themeMode === 'dark' ? (
          <Moon size={22} color={theme.colors.primary} strokeWidth={2} />
        ) : (
          <Sun size={22} color={theme.colors.textMuted} strokeWidth={2} />
        )}
        <View className="flex-1">
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {themeMode === 'dark' ? t('settings.modes.dark') : t('settings.modes.light')}
          </Text>
          <Text variant="caption" tone="muted">
            {themeMode === 'dark'
              ? t('settings.darkModeDesc', { defaultValue: 'Easy on the eyes in low light' })
              : t('settings.lightModeDesc', { defaultValue: 'Bright and clean for daytime' })}
          </Text>
        </View>
        <ThemeToggle
          testID="settings-toggle-dark-mode"
          value={themeMode === 'dark'}
          onValueChange={(isDark) => void setThemeMode(isDark ? 'dark' : 'light')}
        />
      </Pressable>

      <SettingsDivider />

      <View className="gap-xs">
        <Text variant="label" weight="semibold" tone="muted" style={{ fontSize: 12, marginBottom: theme.spacing.xxs }}>
          {t('settings.colorPalette', 'Color Palette')}
        </Text>
        <View className="gap-xxs">
          {THEME_NAMES.map((name) => {
            const isSelected = name === themeName;
            return (
              <Pressable
                key={name}
                testID={`settings-theme-${name}`}
                onPress={() => void setThemeName(name)}
                onPressIn={() => setPressedName(name)}
                onPressOut={() => setPressedName(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: 10,
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressedName === name ? theme.colors.surfaceMuted : 'transparent',
                }}
              >
                <ThemeSwatch name={name} />
                <View className="flex-1">
                  <Text weight={isSelected ? 'bold' : 'medium'} style={{ fontSize: 14 }}>
                    {t(`settings.themeNames.${name}`)}
                  </Text>
                </View>
                {isSelected ? (
                  <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <SettingsDivider />

      <View className="gap-xs py-xs">
        <Text variant="label" weight="semibold" tone="muted" style={{ fontSize: 11 }}>
          {t('settings.preview', { defaultValue: 'Theme preview' })}
        </Text>
        <Text variant="heading" weight="bold" style={{ fontSize: 20 }}>
          ₫12,500,000
        </Text>
        <Text variant="caption" tone="muted">
          {t(`settings.themeNames.${themeName}`)} · {themeMode === 'dark' ? 'Dark' : 'Light'}
        </Text>
      </View>
    </CollapsibleSection>
  );
}

