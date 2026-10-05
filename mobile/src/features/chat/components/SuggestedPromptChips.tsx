import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';

const SUGGESTIONS = ['spending', 'balance', 'budgets', 'record'] as const;

export function SuggestedPromptChips({ disabled, onPick }: { disabled: boolean; onPick: (prompt: string) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  return (
    <View className="flex-row flex-wrap justify-center" style={{ gap: theme.spacing.sm }}>
      {SUGGESTIONS.map((key) => (
        <Pressable
          key={key}
          testID={`btn-ai-suggestion-${key}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onPick(t(`ai.suggestions.${key}`))}
          onPressIn={() => setPressedKey(key)}
          onPressOut={() => setPressedKey(null)}
          style={{
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border,
            backgroundColor: pressedKey === key ? theme.colors.surfaceMuted : theme.colors.surface,
            opacity: disabled ? theme.opacity.disabled : 1,
          }}
        >
          <Text variant="caption">{t(`ai.suggestions.${key}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
