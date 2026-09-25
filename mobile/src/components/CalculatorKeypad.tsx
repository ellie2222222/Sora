import { Calendar, Check, Delete } from 'lucide-react-native';
import { memo, useState, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, View, type ViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  /** Omitted where there's no date to set (e.g. a generic `MoneyInput` field) — the confirm key
   * then takes the whole action column instead of sharing it. */
  onQuickDateRef?: RefObject<() => void>;
  /** The selected day, short enough for one key ("Sep 24"). Only meaningful with `onQuickDateRef`. */
  dateLabel?: string;
  /** Spoken label for the date key — the full date, since `dateLabel` drops the year. */
  dateAccessibilityLabel?: string;
  testID?: string;
}

/** Web only: without this, tapping a key blurs MoneyInput's TextInput mid-press and the docked
 * keypad unmounts itself. `onPointerDown` isn't in RN's `ViewProps` type, hence the cast. */
const preventInputBlur: ViewProps =
  Platform.OS === 'web'
    ? ({ onPointerDown: (e: { preventDefault: () => void }) => e.preventDefault() } as ViewProps)
    : {};

type DigitKey = { label: string; insert: string };
type KeyRow = { digits: DigitKey[]; operator: string };

const DIGIT_ROWS: KeyRow[] = [
  { digits: [{ label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' }], operator: '+' },
  { digits: [{ label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' }], operator: '−' },
  { digits: [{ label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' }], operator: '×' },
];
const LAST_ROW_DIGITS: DigitKey[] = [
  { label: '.', insert: '.' },
  { label: '0', insert: '0' },
];
const LAST_ROW_OPERATOR = '÷';

const KEY_HEIGHT = 48;
const DIGIT_BLOCK_COLUMNS = 4;

/**
 * One of the digit block's four equal columns. Width comes from this border- and padding-free box,
 * never from the key inside it: flex shares space only after subtracting each item's own padding
 * and border, so a padded or borderless key given `flex: 1` directly comes out a different width.
 */
function KeyColumn({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

export const CalculatorKeypad = memo(function CalculatorKeypad({
  expressionRef,
  onExpressionChange,
  onConfirmRef,
  confirmDisabled = false,
  onQuickDateRef,
  dateLabel,
  dateAccessibilityLabel,
  testID,
}: CalculatorKeypadProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const gap = theme.spacing.xs;

  const insert = (token: string) => onExpressionChange(insertToken(expressionRef.current, token));
  const backspace = () => onExpressionChange(expressionRef.current.slice(0, -1));

  const keyFill = (key: string) => (pressedKey === key ? theme.colors.surfacePressed : theme.colors.surfaceElevated);

  const digitCell = (key: DigitKey) => (
    <KeyColumn key={key.label}>
      <Pressable
        testID={testID !== undefined ? `${testID}-key-${key.label}` : undefined}
        accessibilityRole="button"
        accessibilityLabel={key.label}
        onPress={() => insert(key.insert)}
        onPressIn={() => setPressedKey(key.label)}
        onPressOut={() => setPressedKey(null)}
        style={{
          height: KEY_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: keyFill(key.label),
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text variant="title" weight="semibold" numeric style={{ color: theme.colors.text }}>
          {key.label}
        </Text>
      </Pressable>
    </KeyColumn>
  );

  const operatorCell = (glyph: string) => (
    <KeyColumn key={glyph}>
      <Pressable
        testID={testID !== undefined ? `${testID}-key-${glyph}` : undefined}
        accessibilityRole="button"
        accessibilityLabel={glyph}
        onPress={() => insert(glyph)}
        onPressIn={() => setPressedKey(glyph)}
        onPressOut={() => setPressedKey(null)}
        style={{
          height: KEY_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: keyFill(glyph),
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }}
      >
        <Text variant="body" weight="semibold" numeric style={{ color: theme.colors.primary }}>
          {glyph}
        </Text>
      </Pressable>
    </KeyColumn>
  );

  const rowStyle = { flexDirection: 'row', gap } as const;

  return (
    <View testID={testID} style={rowStyle} {...preventInputBlur}>
      {/* flexBasis carries the block's inner gaps, so its four columns and the action column
          below all resolve to the same width. */}
      <View style={{ flexGrow: DIGIT_BLOCK_COLUMNS, flexShrink: 1, flexBasis: gap * (DIGIT_BLOCK_COLUMNS - 1), gap }}>
        {DIGIT_ROWS.map((row) => (
          <View key={row.operator} style={rowStyle}>
            {row.digits.map(digitCell)}
            {operatorCell(row.operator)}
          </View>
        ))}
        <View style={rowStyle}>
          {LAST_ROW_DIGITS.map(digitCell)}
          <KeyColumn>
            <Pressable
              testID={testID !== undefined ? `${testID}-key-backspace` : undefined}
              accessibilityRole="button"
              accessibilityLabel={t('common.backspace', 'Backspace')}
              onPress={backspace}
              onPressIn={() => setPressedKey('backspace')}
              onPressOut={() => setPressedKey(null)}
              style={{
                height: KEY_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: keyFill('backspace'),
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Delete size={20} color={theme.colors.text} strokeWidth={1.75} />
            </Pressable>
          </KeyColumn>
          {operatorCell(LAST_ROW_OPERATOR)}
        </View>
      </View>

      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, gap }}>
        {onQuickDateRef !== undefined ? (
          <Pressable
            testID={testID !== undefined ? `${testID}-key-date` : undefined}
            accessibilityRole="button"
            accessibilityLabel={dateAccessibilityLabel ?? dateLabel}
            onPress={() => onQuickDateRef.current()}
            onPressIn={() => setPressedKey('date')}
            onPressOut={() => setPressedKey(null)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xxs,
              paddingHorizontal: theme.spacing.xxs,
              backgroundColor: theme.colors.primary,
              opacity: pressedKey === 'date' ? 0.85 : 1,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
          >
            <Calendar size={16} color={theme.colors.onPrimary} strokeWidth={2.25} />
            {dateLabel !== undefined ? (
              <Text
                variant="label"
                weight="semibold"
                numeric
                numberOfLines={2}
                style={{ color: theme.colors.onPrimary, textAlign: 'center' }}
              >
                {dateLabel}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          testID={testID !== undefined ? `${testID}-key-confirm` : undefined}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel={t('common.confirm', 'Confirm')}
          accessibilityState={{ disabled: confirmDisabled }}
          onPress={() => onConfirmRef.current()}
          onPressIn={() => setPressedKey('confirm')}
          onPressOut={() => setPressedKey(null)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: confirmDisabled ? theme.colors.buttonPrimaryDisabledBackground : theme.colors.primary,
            opacity: !confirmDisabled && pressedKey === 'confirm' ? 0.85 : 1,
            borderWidth: 1,
            borderColor: confirmDisabled ? theme.colors.buttonPrimaryDisabledBorder : theme.colors.primary,
          }}
        >
          <Check
            size={20}
            color={confirmDisabled ? theme.colors.buttonPrimaryDisabledText : theme.colors.onPrimary}
            strokeWidth={2.5}
          />
        </Pressable>
      </View>
    </View>
  );
});
