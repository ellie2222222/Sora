import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

/**
 * A section's small upper-case heading, with an optional action on its right. Sections are told apart
 * by this and by spacing rather than by a card around each one.
 */
export function SectionLabel({ children, action, testID }: { children: string; action?: ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <View testID={testID} className="flex-row items-center justify-between" style={{ gap: theme.spacing.md }}>
      <Text
        variant="caption"
        weight="bold"
        tone="muted"
        numberOfLines={1}
        style={{ flexShrink: 1, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.caps }}
      >
        {children}
      </Text>
      {action}
    </View>
  );
}
