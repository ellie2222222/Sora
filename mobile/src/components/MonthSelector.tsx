import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Text } from './Text.tsx';

export interface MonthSelectorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onOpenPicker?: () => void;
  disableNext?: boolean;
  testID?: string;
}

/** Unified period selector: `‹ September 2026 [Calendar] ›` */
export function MonthSelector({
  label,
  onPrev,
  onNext,
  onOpenPicker,
  disableNext = false,
  testID,
}: MonthSelectorProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        hitSlop={12}
        style={({ pressed }) => ({
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          backgroundColor: pressed ? theme.colors.border : 'transparent',
        })}
      >
        <ChevronLeft size={20} color={theme.colors.textMuted} />
      </Pressable>

      <Pressable
        testID={testID !== undefined ? `${testID}-picker-trigger` : undefined}
        accessibilityRole="button"
        accessibilityLabel="Select date or year"
        onPress={onOpenPicker}
        disabled={!onOpenPicker}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        })}
      >
        <Text weight="semibold" style={{ fontSize: theme.fontSize.sm, color: theme.colors.text }}>
          {label}
        </Text>
        {onOpenPicker ? <Calendar size={15} color={theme.colors.primary} /> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={onNext}
        disabled={disableNext}
        hitSlop={12}
        style={({ pressed }) => ({
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          backgroundColor: pressed ? theme.colors.border : 'transparent',
          opacity: disableNext ? 0.3 : 1,
        })}
      >
        <ChevronRight size={20} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}
