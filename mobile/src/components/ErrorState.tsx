import { TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { messageOf } from '../utils/errors.ts';
import { Button } from './Button.tsx';
import { Text } from './Text.tsx';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  testID?: string;
}

/**
 * Renders the server's own message (the ownership rule in CLAUDE.md: the API
 * owns every message it puts on the wire) and falls back only for transport
 * failures that never reached it.
 */
export function ErrorState({ error, onRetry, testID }: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
        gap: theme.spacing.sm,
      }}
    >
      <TriangleAlert size={40} color={theme.colors.danger} strokeWidth={1.5} />
      <Text variant="title" tone="danger" style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
        {messageOf(error)}
      </Text>
      {onRetry !== undefined ? (
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          style={{ marginTop: theme.spacing.md }}
          testID={testID !== undefined ? `${testID}-retry` : undefined}
        />
      ) : null}
    </View>
  );
}
