import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Button } from './Button.tsx';
import { Text } from './Text.tsx';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, testID }: EmptyStateProps) {
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
      <Icon size={40} color={theme.colors.textFaint} strokeWidth={1.5} />
      <Text variant="title" style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
        {title}
      </Text>
      {description !== undefined ? (
        <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {actionLabel !== undefined && onAction !== undefined ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: theme.spacing.md }}
          testID={testID !== undefined ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}
