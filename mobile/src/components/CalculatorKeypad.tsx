import { Delete } from 'lucide-react-native';
import { memo, useState, type RefObject } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface CalculatorKeypadProps {
  /**
   * A ref rather than a plain string: the key grid's own render never depends on the expression's
   * *value* (only `handlePress`'s append/backspace logic reads it), so reading it through a ref lets
   * `memo` skip re-rendering all 20 keys on every keystroke — only the ref's `.current` needs to be
   * current when a key is actually pressed, not on every parent re-render.
   */
  expressionRef: RefObject<string>;
  onExpressionChange: (next: string) => void;
  testID?: string;
}

type KeyDef =
  | { kind: 'insert'; label: string; insert: string; accent?: 'operator' }
  | { kind: 'backspace'; label: string }
  | { kind: 'clear'; label: string };

const ROWS: KeyDef[][] = [
  [
    { kind: 'insert', label: '(', insert: '(' },
    { kind: 'insert', label: ')', insert: ')' },
    { kind: 'insert', label: '^', insert: '^', accent: 'operator' },
    { kind: 'backspace', label: 'backspace' },
  ],
  [
    { kind: 'insert', label: '7', insert: '7' },
    { kind: 'insert', label: '8', insert: '8' },
    { kind: 'insert', label: '9', insert: '9' },
    { kind: 'insert', label: '÷', insert: '÷', accent: 'operator' },
  ],
  [
    { kind: 'insert', label: '4', insert: '4' },
    { kind: 'insert', label: '5', insert: '5' },
    { kind: 'insert', label: '6', insert: '6' },
    { kind: 'insert', label: '×', insert: '×', accent: 'operator' },
  ],
  [
    { kind: 'insert', label: '1', insert: '1' },
    { kind: 'insert', label: '2', insert: '2' },
    { kind: 'insert', label: '3', insert: '3' },
    { kind: 'insert', label: '−', insert: '−', accent: 'operator' },
  ],
  [
    { kind: 'clear', label: 'AC' },
    { kind: 'insert', label: '0', insert: '0' },
    { kind: 'insert', label: '.', insert: '.' },
    { kind: 'insert', label: '+', insert: '+', accent: 'operator' },
  ],
];

export const CalculatorKeypad = memo(function CalculatorKeypad({
  expressionRef,
  onExpressionChange,
  testID,
}: CalculatorKeypadProps) {
  const theme = useTheme();
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const handlePress = (key: KeyDef) => {
    const expression = expressionRef.current;
    if (key.kind === 'clear') {
      onExpressionChange('');
    } else if (key.kind === 'backspace') {
      onExpressionChange(expression.slice(0, -1));
    } else {
      onExpressionChange(expression + key.insert);
    }
  };

  return (
    <View testID={testID} style={{ gap: theme.spacing.xs }}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          {row.map((key) => {
            const isPressed = pressedKey === key.label;
            const isClear = key.kind === 'clear';
            const isOperator = key.kind === 'insert' && key.accent === 'operator';
            return (
              <Pressable
                key={key.label}
                testID={testID !== undefined ? `${testID}-key-${key.label}` : undefined}
                accessibilityRole="button"
                accessibilityLabel={key.kind === 'backspace' ? 'Backspace' : key.kind === 'clear' ? 'Clear' : key.label}
                onPress={() => handlePress(key)}
                onPressIn={() => setPressedKey(key.label)}
                onPressOut={() => setPressedKey(null)}
                style={{
                  flex: 1,
                  height: 46,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.md,
                  backgroundColor: isPressed
                    ? theme.colors.surfaceMuted
                    : isClear
                      ? theme.colors.dangerMuted
                      : theme.colors.surfaceElevated,
                }}
              >
                {key.kind === 'backspace' ? (
                  <Delete size={20} color={theme.colors.text} strokeWidth={1.75} />
                ) : (
                  <Text
                    variant="title"
                    weight="semibold"
                    numeric
                    style={{
                      color: isClear ? theme.colors.danger : isOperator ? theme.colors.primary : theme.colors.text,
                    }}
                  >
                    {key.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});
