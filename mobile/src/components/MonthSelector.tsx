import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Text } from './Text.tsx';

export interface MonthSelectorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext?: boolean;
  testID?: string;
}

/** Compact `‹ September 2026 ›` control — Home's month scope and Report's Monthly period. */
export function MonthSelector({ label, onPrev, onNext, disableNext = false, testID }: MonthSelectorProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        hitSlop={8}
        style={{ padding: theme.spacing.xs }}
      >
        <ChevronLeft size={18} color={theme.colors.textMuted} />
      </Pressable>
      <Text variant="title" weight="semibold" style={{ minWidth: 120, textAlign: 'center' }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={onNext}
        disabled={disableNext}
        hitSlop={8}
        style={{ padding: theme.spacing.xs, opacity: disableNext ? 0.3 : 1 }}
      >
        <ChevronRight size={18} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}
