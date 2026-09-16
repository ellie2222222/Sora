import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
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
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [prevPressed, setPrevPressed] = useState(false);
  const [triggerPressed, setTriggerPressed] = useState(false);
  const [nextPressed, setNextPressed] = useState(false);

  return (
    <View testID={testID} className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        onPressIn={() => setPrevPressed(true)}
        onPressOut={() => setPrevPressed(false)}
        hitSlop={12}
        style={{
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          backgroundColor: prevPressed ? theme.colors.border : 'transparent',
        }}
      >
        <ChevronLeft size={20} color={theme.colors.textMuted} />
      </Pressable>

      <Pressable
        testID={testID !== undefined ? `${testID}-picker-trigger` : undefined}
        accessibilityRole="button"
        accessibilityLabel="Select date or year"
        onPress={onOpenPicker}
        onPressIn={() => setTriggerPressed(true)}
        onPressOut={() => setTriggerPressed(false)}
        disabled={!onOpenPicker}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          backgroundColor: triggerPressed ? theme.colors.border : theme.colors.surface,
          borderColor: theme.colors.border,
        }}
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
        onPressIn={() => setNextPressed(true)}
        onPressOut={() => setNextPressed(false)}
        disabled={disableNext}
        hitSlop={12}
        style={{
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          backgroundColor: nextPressed ? theme.colors.border : 'transparent',
          opacity: disableNext ? 0.3 : 1,
        }}
      >
        <ChevronRight size={20} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}
