import { Pressable, View } from 'react-native';
import { ChevronDown, X, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface IconChipProps {
  icon: LucideIcon;
  label: string;
  /** Renders the label faint, for an unset value's placeholder text. */
  placeholder?: boolean;
  /** Makes the chip a button, with a chevron hinting that it opens a picker. */
  onPress?: () => void;
  /** Adds a clear button after the label. */
  onClear?: () => void;
  clearAccessibilityLabel?: string;
  /** Spoken label when it should say more than the visible text. */
  accessibilityLabel?: string;
  error?: boolean;
  testID?: string;
}

/** The footer summary chip beside the amount on the keypad-driven create sheets. */
export function IconChip({
  icon: Icon,
  label,
  placeholder = false,
  onPress,
  onClear,
  clearAccessibilityLabel,
  accessibilityLabel,
  error = false,
  testID,
}: IconChipProps) {
  const theme = useTheme();

  const body = (
    <>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: error ? theme.colors.dangerMuted : theme.colors.warningMuted,
        }}
      >
        <Icon size={16} color={error ? theme.colors.danger : theme.colors.warning} strokeWidth={2} />
      </View>
      {onPress !== undefined && onClear === undefined ? <ChevronDown size={14} color={theme.colors.textMuted} /> : null}
      <Text tone={placeholder ? 'faint' : 'muted'} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </>
  );

  return (
    <View className="flex-row items-center" style={{ flexShrink: 1, gap: theme.spacing.xs }}>
      {onPress !== undefined ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          className="flex-row items-center"
          style={{ flexShrink: 1, gap: theme.spacing.xs, minHeight: 44 }}
        >
          {body}
        </Pressable>
      ) : (
        <View testID={testID} className="flex-row items-center" style={{ flexShrink: 1, gap: theme.spacing.xs }}>
          {body}
        </View>
      )}
      {onClear !== undefined ? (
        <Pressable
          testID={testID !== undefined ? `${testID}-clear` : undefined}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          // A real 44pt box rather than hitSlop, so the target cannot spill onto the chip's own button;
          // the negative margin cancels the row gap so the two boxes abut instead.
          style={{ width: 44, height: 44, marginLeft: -theme.spacing.xs, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
