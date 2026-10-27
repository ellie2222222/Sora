import { Check, Moon, Palette, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Money, Text, ThemedIcon, ThemedPressable, ThemedView, ThemeToggle } from '@/components';
import { useTheme, useThemeControl } from '@/app/providers';
import { PALETTE_RAMPS, THEME_NAMES, type ThemeName } from '@/design-system';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

const PREVIEW_AMOUNT = '12500000';

function ThemeSwatch({ name }: { name: ThemeName }) {
  const theme = useTheme();
  const ramp = PALETTE_RAMPS[name];

  return (
    <ThemedView
      className="rounded-sm overflow-hidden flex-row"
      style={{
        width: theme.sizes.swatch.width,
        height: theme.sizes.swatch.height,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border,
      }}
    >
      <View className="flex-1" style={{ backgroundColor: ramp[300] }} />
      <View className="flex-1" style={{ backgroundColor: ramp[600] }} />
      <View className="flex-1" style={{ backgroundColor: ramp[900] }} />
    </ThemedView>
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
      icon={<ThemedIcon icon={Palette} size={theme.iconSize.lg} color={theme.colors.textMuted} />}
      title={t('settings.appearance')}
      subtitle={appearanceSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <ThemedPressable
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
          <ThemedIcon icon={Moon} size={theme.iconSize.lg} color={theme.colors.primary} />
        ) : (
          <ThemedIcon icon={Sun} size={theme.iconSize.lg} color={theme.colors.textMuted} />
        )}
        <View className="flex-1">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {themeMode === 'dark' ? t('settings.modes.dark') : t('settings.modes.light')}
          </Text>
          <Text variant="caption" tone="muted">
            {themeMode === 'dark'
              ? t('settings.darkModeDesc')
              : t('settings.lightModeDesc')}
          </Text>
        </View>
        <ThemeToggle
          testID="settings-toggle-dark-mode"
          value={themeMode === 'dark'}
          onValueChange={(isDark) => void setThemeMode(isDark ? 'dark' : 'light')}
        />
      </ThemedPressable>

      <SettingsDivider />

      <View className="gap-xs">
        <Text variant="label" weight="semibold" tone="muted" style={{ marginBottom: theme.spacing.xxs }}>
          {t('settings.colorPalette')}
        </Text>
        <View className="gap-xxs">
          {THEME_NAMES.map((name) => {
            const isSelected = name === themeName;
            return (
              <ThemedPressable
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
                  minHeight: theme.sizes.touchTarget,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressedName === name ? theme.colors.surfaceMuted : 'transparent',
                }}
              >
                <ThemeSwatch name={name} />
                <View className="flex-1">
                  <Text weight={isSelected ? 'bold' : 'medium'} style={{ fontSize: theme.fontSize.sm }}>
                    {t(`settings.themeNames.${name}`)}
                  </Text>
                </View>
                {isSelected ? (
                  <ThemedIcon icon={Check} size={theme.iconSize.lg} color={theme.colors.primary} strokeWidth={theme.iconStroke.bold} />
                ) : null}
              </ThemedPressable>
            );
          })}
        </View>
      </View>

      <SettingsDivider />

      <View className="gap-xs py-xs">
        <Text variant="label" weight="semibold" tone="muted">
          {t('settings.preview')}
        </Text>
        <Money amount={PREVIEW_AMOUNT} currency="VND" variant="heading" weight="bold" style={{ fontSize: theme.fontSize.xl }} />
        <Text variant="caption" tone="muted">
          {appearanceSubtitle}
        </Text>
      </View>
    </CollapsibleSection>
  );
}

