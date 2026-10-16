import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
import { concentricRadius, type Theme } from '@/design-system';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testID: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

function trackStyle(theme: Theme) {
  return {
    padding: theme.spacing.xxs,
    borderWidth: theme.borderWidth.thin,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
  };
}

// The selected fill sits barely apart from the track in dark mode, so the primary border (3:1) carries the state.
// Every segment keeps the border width, so selecting one never shifts the row.
function segmentStyle(theme: Theme, selected: boolean) {
  return {
    borderRadius: concentricRadius(theme.radius.md, theme.borderWidth.thin, theme.spacing.xxs),
    borderWidth: theme.borderWidth.thin,
    borderColor: selected ? theme.colors.primary : 'transparent',
    backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
  };
}

/** Equal-width tabs on a muted track; the selected one is tinted, outlined and labelled in `primary`. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View className="flex-row" style={trackStyle(theme)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-1 py-sm items-center justify-center"
            style={segmentStyle(theme, selected)}
          >
            <Text
              weight={selected ? 'bold' : 'medium'}
              tone={selected ? undefined : 'muted'}
              style={{ fontSize: theme.fontSize.sm, ...(selected ? { color: theme.colors.primary } : null) }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The same track while its screen loads, the first segment shown selected. */
export function SegmentedControlSkeleton({ count }: { count: number }) {
  const theme = useTheme();

  return (
    <View className="flex-row" style={trackStyle(theme)}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="flex-1 py-sm items-center justify-center" style={segmentStyle(theme, i === 0)}>
          <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        </View>
      ))}
    </View>
  );
}
