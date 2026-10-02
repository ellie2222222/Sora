import { useState } from 'react';
import { SendHorizontal } from 'lucide-react-native';
import { Pressable, TextInput, Text, View } from 'react-native';
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

    <View style={{ flex: 1, position: 'relative' }}>
      <TextInput
        testID="input-ai-message"
        value={text}
        onChangeText={setText}
        placeholder=""
        editable={!disabled}
        multiline
        maxLength={MAX_LENGTH}
        style={{
          minHeight: 44,
          maxHeight: 120,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          fontSize: theme.fontSize.md,
          fontFamily: theme.fontFamily.regular,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: theme.colors.borderControl,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          textAlignVertical: 'top',
          opacity: disabled ? 0.6 : 1,
        }}
      />

      {!text && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: theme.spacing.md,
            right: theme.spacing.md,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: theme.fontSize.md,
              fontFamily: theme.fontFamily.regular,
              color: theme.colors.textFaint,
            }}
          >
            {t('ai.inputPlaceholder')}
          </Text>
        </View>
      )}
    </View>
  );
}
