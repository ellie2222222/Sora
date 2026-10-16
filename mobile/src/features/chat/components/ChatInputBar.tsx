import { useEffect, useState } from 'react';
import { SendHorizontal } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { concentricRadius } from '@/design-system';

const MAX_LENGTH = 2000;
/** A web `<textarea>` with no `rows` is two lines tall; on native, `rows` would cap the field's growth instead. */
const SINGLE_ROW_ON_WEB = Platform.OS === 'web' ? { rows: 1 } : {};

export function ChatInputBar({
  disabled,
  busy = false,
  onSend,
  placeholder,
  refill,
}: {
  disabled: boolean;
  /** A message is out: the send button shows it is working rather than just greyed out. */
  busy?: boolean;
  onSend: (message: string) => Promise<boolean>;
  /** Replaces the default prompt, e.g. to say why the field is disabled. */
  placeholder?: string;
  /** Puts text back in the field, e.g. an unsent message the user chose to edit; a new `nonce` repeats it. */
  refill?: { text: string; nonce: number };
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (refill) setText(refill.text);
  }, [refill]);

  const sendSize = theme.sizes.badge.md;
  const fieldMinHeight = theme.sizes.controlHeight;
  const sendInset = (fieldMinHeight - sendSize) / 2;
  /** Explicit, so one line is the same height on every platform and the padding below centres it. */
  const lineHeight = theme.lineHeight.md;

  const trimmed = text.trim();
  const canSend = !disabled && trimmed.length > 0;
  const prompt = placeholder ?? t('ai.inputPlaceholder');

  const send = async () => {
    if (!canSend) return;
    setText('');
    if (!(await onSend(trimmed))) setText(trimmed);
  };

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderTopWidth: theme.borderWidth.thin,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        className="flex-row items-end"
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: theme.borderWidth.thin,
          borderColor: disabled ? theme.colors.border : focused ? theme.colors.primary : theme.colors.borderControl,
          backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.surface,
        }}
      >
        <TextInput
          testID="input-ai-message"
          accessibilityLabel={prompt}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={prompt}
          placeholderTextColor={theme.colors.textFaint}
          editable={!disabled}
          multiline
          {...SINGLE_ROW_ON_WEB}
          maxLength={MAX_LENGTH}
          style={{
            flex: 1,
            minHeight: fieldMinHeight,
            maxHeight: 6 * lineHeight,
            paddingLeft: theme.spacing.lg,
            paddingRight: theme.spacing.xs,
            paddingVertical: (fieldMinHeight - lineHeight) / 2,
            fontSize: theme.fontSize.md,
            lineHeight,
            fontFamily: theme.fontFamily.regular,
            color: disabled ? theme.colors.textFaint : theme.colors.text,
            textAlignVertical: 'center',
            // The web build's default focus ring; the border colour above is the focus cue.
            ...({ outlineStyle: 'none', outlineWidth: 0 } as object),
          }}
        />
        <Pressable
          testID="btn-submit-ai-message"
          accessibilityRole="button"
          accessibilityLabel={t('ai.send')}
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          hitSlop={theme.sizes.hitSlop.sm}
          onPress={() => void send()}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            width: sendSize,
            height: sendSize,
            margin: sendInset,
            borderRadius: concentricRadius(theme.radius.xl, theme.borderWidth.thin, sendInset),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSend ? theme.colors.primary : theme.colors.border,
            opacity: canSend && pressed ? theme.opacity.pressed : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.textMuted} />
          ) : (
            <SendHorizontal size={theme.iconSize.lg} color={canSend ? theme.colors.onPrimary : theme.colors.textFaint} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
