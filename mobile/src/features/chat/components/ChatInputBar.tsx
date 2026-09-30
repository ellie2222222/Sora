import { useState } from 'react';
import { SendHorizontal } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';

const MAX_LENGTH = 2000;

export function ChatInputBar({ disabled, onSend }: { disabled: boolean; onSend: (message: string) => Promise<boolean> }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [pressed, setPressed] = useState(false);

  const trimmed = text.trim();
  const canSend = !disabled && trimmed.length > 0;

  const send = async () => {
    if (!canSend) return;
    setText('');
    if (!(await onSend(trimmed))) setText(trimmed);
  };

  return (
    <View
      className="flex-row items-end"
      style={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <TextInput
        testID="input-ai-message"
        value={text}
        onChangeText={setText}
        placeholder={t('ai.inputPlaceholder')}
        placeholderTextColor={theme.colors.textFaint}
        editable={!disabled}
        multiline
        maxLength={MAX_LENGTH}
        style={{
          flex: 1,
          maxHeight: 120,
          minHeight: 40,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.borderControl,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          opacity: disabled ? 0.6 : 1,
        }}
      />
      <Pressable
        testID="btn-submit-ai-message"
        accessibilityRole="button"
        accessibilityLabel={t('ai.send')}
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => void send()}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSend ? (pressed ? theme.colors.primaryMuted : theme.colors.primary) : theme.colors.surfaceMuted,
        }}
      >
        <SendHorizontal size={18} color={canSend ? theme.colors.onPrimary : theme.colors.textFaint} />
      </Pressable>
    </View>
  );
}
