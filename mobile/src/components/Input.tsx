import { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputProps,
} from 'react-native';

import { formatCurrencyInput } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface InputProps extends TextInputProps {
  label?: string;
  /** The first message wins; a field showing three errors at once reads as noise. */
  error?: string | string[];
  testID?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, testID, onFocus, onBlur, onChangeText, keyboardType, inputMode, ...props },
  ref,
) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const message = Array.isArray(error) ? error[0] : error;
  const hasError = message !== undefined && message.length > 0;

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setIsFocused(true);
    onFocus?.(e as never);
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setIsFocused(false);
    onBlur?.(e as never);
  };

  const handleTextChange = (text: string) => {
    if (!onChangeText) return;
    if (keyboardType === 'decimal-pad') {
      onChangeText(formatCurrencyInput(text, true));
    } else if (keyboardType === 'numeric' || keyboardType === 'number-pad') {
      onChangeText(formatCurrencyInput(text, false));
    } else {
      onChangeText(text);
    }
  };

  const computedInputMode =
    inputMode ??
    (keyboardType === 'decimal-pad'
      ? 'decimal'
      : keyboardType === 'numeric' || keyboardType === 'number-pad'
      ? 'numeric'
      : undefined);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label !== undefined ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        testID={testID}
        placeholderTextColor={theme.colors.textFaint}
        accessibilityLabel={label}
        keyboardType={keyboardType}
        inputMode={computedInputMode}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="h-[48px]"
        style={[
          {
            borderRadius: theme.radius.md,
            borderWidth: isFocused || hasError ? 1.5 : 1,
            borderColor: hasError
              ? theme.colors.danger
              : isFocused
              ? theme.colors.primary
              : theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.md,
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
            fontFamily: theme.fontFamily.regular,
            ...( { outlineStyle: 'none', outlineWidth: 0 } as object ),
          },
          style,
        ]}
        {...props}
      />
      {hasError ? (
        <Text variant="caption" tone="danger" testID={testID !== undefined ? `${testID}-error` : undefined}>
          {message}
        </Text>
      ) : null}
    </View>
  );
});
