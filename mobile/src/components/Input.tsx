import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Text } from './Text.tsx';

export interface InputProps extends TextInputProps {
  label?: string;
  /** The first message wins; a field showing three errors at once reads as noise. */
  error?: string | string[];
  testID?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, testID, ...props },
  ref,
) {
  const theme = useTheme();
  const message = Array.isArray(error) ? error[0] : error;
  const hasError = message !== undefined && message.length > 0;

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
        style={[
          {
            height: 48,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.md,
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
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
