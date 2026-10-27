import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, ThemedPressable } from '@/components';
import { useTheme } from '@/app/providers';

const SUGGESTIONS = ['spending', 'balance', 'budgets', 'record'] as const;

export function SuggestedPromptChips({ disabled, onPick }: { disabled: boolean; onPick: (prompt: string) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const chipSlop = Math.max(0, (theme.sizes.touchTarget - theme.lineHeight.sm - 2 * theme.spacing.xs) / 2);

  return (
    <View className="flex-row flex-wrap justify-center" style={{ gap: theme.spacing.sm }}>
      {SUGGESTIONS.map((key) => (
        <ThemedPressable
          key={key}
          testID={`btn-ai-suggestion-${key}`}
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={{ top: chipSlop, bottom: chipSlop }}
          onPress={() => onPick(t(`ai.suggestions.${key}`))}
          onPressIn={() => setPressedKey(key)}
          onPressOut={() => setPressedKey(null)}
          style={{
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border,
            backgroundColor: disabled || pressedKey === key ? theme.colors.surfaceMuted : theme.colors.surface,
          }}
        >
          <Text variant="caption" tone={disabled ? 'muted' : 'default'}>
            {t(`ai.suggestions.${key}`)}
          </Text>
        </ThemedPressable>
      ))}
    </View>
  );
}
