import { Check, Delete } from 'lucide-react-native';
import { memo, useState, type RefObject } from 'react';
import { Platform, Pressable, View, type ViewProps } from 'react-native';

import { useTheme } from '@/app/providers';
import { insertToken } from '@/utils';
import { Text } from './Text.tsx';

export interface CalculatorKeypadProps {
  /**
   * A ref rather than a plain string: the key grid's own render never depends on the expression's
   * *value* (only key-press handling reads it), so reading it through a ref lets `memo` skip
   * re-rendering all keys on every keystroke — only the ref's `.current` needs to be current when
   * a key is actually pressed, not on every parent re-render.
   */
  expressionRef: RefObject<string>;
  onExpressionChange: (next: string) => void;
  /** Read at press time, same ref pattern as `expressionRef` — keeps this prop's identity stable
   * across renders even though what it does changes every keystroke (it decides evaluate vs.
   * submit from the current expression), so passing it directly would defeat `memo` below. */
  onConfirmRef: RefObject<() => void>;
  confirmDisabled?: boolean;
  /** Omitted where there's no date to set (e.g. a generic `MoneyInput` field) — row 1 then renders
   * as plain 3-wide digits instead of reserving a 4th, empty cell. */
  onQuickDateRef?: RefObject<() => void>;
  /** Text on the date key — e.g. "Today" or a formatted day once one is picked. Only meaningful
   * together with `onQuickDateRef`; defaults to "Today" when that's set but this isn't. */
  dateLabel?: string;
  testID?: string;
}

/** Web only: without this, tapping a key blurs MoneyInput's TextInput mid-press and the docked
 * keypad unmounts itself. `onPointerDown` isn't in RN's `ViewProps` type, hence the cast. */
const preventInputBlur: ViewProps =
  Platform.OS === 'web'
    ? ({ onPointerDown: (e: { preventDefault: () => void }) => e.preventDefault() } as ViewProps)
    : {};

type DigitKey = { label: string; insert: string };

const ROW_789: DigitKey[] = [
  { label: '7', insert: '7' },
  { label: '8', insert: '8' },
  { label: '9', insert: '9' },
];
const ROW_456: DigitKey[] = [
  { label: '4', insert: '4' },
  { label: '5', insert: '5' },
  { label: '6', insert: '6' },
];
const ROW_123: DigitKey[] = [
  { label: '1', insert: '1' },
  { label: '2', insert: '2' },
  { label: '3', insert: '3' },
];

const KEY_HEIGHT = 46;

export const CalculatorKeypad = memo(function CalculatorKeypad({
  expressionRef,
  onExpressionChange,
  onConfirmRef,
  confirmDisabled = false,
  onQuickDateRef,
  dateLabel = 'Today',
  testID,
}: CalculatorKeypadProps) {
  const theme = useTheme();
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const insert = (token: string) => onExpressionChange(insertToken(expressionRef.current, token));
  const backspace = () => onExpressionChange(expressionRef.current.slice(0, -1));

  const digitCell = (key: DigitKey) => (
    <Pressable
      key={key.label}
      testID={testID !== undefined ? `${testID}-key-${key.label}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={key.label}
      onPress={() => insert(key.insert)}
      onPressIn={() => setPressedKey(key.label)}
      onPressOut={() => setPressedKey(null)}
      style={{
        flex: 1,
        height: KEY_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressedKey === key.label ? theme.colors.surfaceMuted : theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text variant="title" weight="semibold" numeric style={{ color: theme.colors.text }}>
        {key.label}
      </Text>
    </Pressable>
  );

  const operatorCell = (glyph: string) => (
    <Pressable
      key={glyph}
      testID={testID !== undefined ? `${testID}-key-${glyph}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={glyph}
      onPress={() => insert(glyph)}
      onPressIn={() => setPressedKey(glyph)}
      onPressOut={() => setPressedKey(null)}
      style={{
        flex: 1,
        height: KEY_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressedKey === glyph ? theme.colors.surfaceMuted : theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.primary,
      }}
    >
      <Text variant="body" weight="semibold" numeric style={{ color: theme.colors.primary }}>
        {glyph}
      </Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={{ gap: theme.spacing.xs }} {...preventInputBlur}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {ROW_789.map(digitCell)}
        {onQuickDateRef !== undefined ? (
          <Pressable
            testID={testID !== undefined ? `${testID}-key-today` : undefined}
            accessibilityRole="button"
            accessibilityLabel={dateLabel}
            onPress={() => onQuickDateRef.current()}
            onPressIn={() => setPressedKey('today')}
            onPressOut={() => setPressedKey(null)}
            style={{
              flex: 1,
              height: KEY_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressedKey === 'today' ? theme.colors.surfaceMuted : theme.colors.surfaceElevated,
              borderWidth: 1,
              borderColor: theme.colors.warning,
            }}
          >
            {/* No icon here — the date can be a full formatted day ("22 Sep 2026"), and an icon
             * alongside it pushed the text past the cell's width into an ellipsis. */}
            <Text variant="label" weight="semibold" numberOfLines={1} style={{ color: theme.colors.warning }}>
              {dateLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {ROW_456.map(digitCell)}
        <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.xxs }}>
          {operatorCell('+')}
          {operatorCell('−')}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {ROW_123.map(digitCell)}
        <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.xxs }}>
          {operatorCell('×')}
          {operatorCell('÷')}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {digitCell({ label: '.', insert: '.' })}
        {digitCell({ label: '0', insert: '0' })}
        <Pressable
          testID={testID !== undefined ? `${testID}-key-backspace` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Backspace"
          onPress={backspace}
          onPressIn={() => setPressedKey('backspace')}
          onPressOut={() => setPressedKey(null)}
          style={{
            flex: 1,
            height: KEY_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressedKey === 'backspace' ? theme.colors.surfaceMuted : theme.colors.surfaceElevated,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Delete size={20} color={theme.colors.text} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          testID={testID !== undefined ? `${testID}-key-confirm` : undefined}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel="Confirm"
          onPress={() => onConfirmRef.current()}
          onPressIn={() => setPressedKey('confirm')}
          onPressOut={() => setPressedKey(null)}
          style={{
            flex: 1,
            height: KEY_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
            opacity: confirmDisabled ? 0.5 : pressedKey === 'confirm' ? 0.85 : 1,
            borderWidth: 1,
            borderColor: theme.colors.primary,
          }}
        >
          <Check size={20} color={theme.colors.onPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
});
