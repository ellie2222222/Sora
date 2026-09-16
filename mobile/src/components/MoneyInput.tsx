import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { formatCurrencyInput, formatMoney, formatMoneyCompact } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { tryEvaluate } from '@/utils';
import { CalculatorKeypad } from './CalculatorKeypad.tsx';
import { useKeyboardDock } from './KeyboardDockProvider.tsx';
import { Text } from './Text.tsx';

export interface MoneyInputProps {
  /** Plain decimal string (MoneyString), e.g. "1500.0000" — kept in sync with the live-evaluated result. */
  value: string;
  onChangeValue: (value: string) => void;
  label?: string;
  error?: string | string[];
  placeholder?: string;
  testID?: string;
}

const HAS_OPERATOR = /[+−×÷^]/;

let instanceCounter = 0;

/**
 * A money-amount field whose only input method is the calculator keypad docked by the nearest
 * `KeyboardDockProvider` (a `BottomSheetModal` or a screen that wraps itself in one) — the field
 * stays the focused, cursor-bearing element, but `showSoftInputOnFocus={false}` keeps the native
 * keyboard from ever appearing underneath it; text only ever changes through the docked keypad.
 */
export function MoneyInput({ value, onChangeValue, label, error, placeholder = '0', testID }: MoneyInputProps) {
  const theme = useTheme();
  const { setDockedKeypad } = useKeyboardDock();
  const idRef = useRef(testID ?? `money-input-${(instanceCounter += 1)}`);
  const inputRef = useRef<TextInput>(null);

  const [expression, setExpression] = useState(value);
  const [focused, setFocused] = useState(false);
  // Read by CalculatorKeypad's key-press handling without forcing its 20-key grid to re-render on
  // every keystroke — see the comment on CalculatorKeypadProps.expressionRef.
  const expressionRef = useRef(expression);
  expressionRef.current = expression;
  const message = Array.isArray(error) ? error[0] : error;
  const hasError = message !== undefined && message.length > 0;

  const evaluated = useMemo(() => tryEvaluate(expression), [expression]);

  // Tracks the value this component itself last emitted, so a parent-driven reset of `value`
  // (e.g. a modal clearing its form on reopen without unmounting) can be told apart from our own
  // echo and re-sync `expression` — these modals keep MoneyInput mounted across visible toggles.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (expression.trim() === '') {
      if (lastEmittedRef.current !== '') {
        lastEmittedRef.current = '';
        onChangeValue('');
      }
      return;
    }
    if (evaluated !== null) {
      const formatted = formatMoney(evaluated);
      if (lastEmittedRef.current !== formatted) {
        lastEmittedRef.current = formatted;
        onChangeValue(formatted);
      }
    }
    // Mid-typing an incomplete expression (trailing operator, unmatched paren) leaves the last
    // committed value in place instead of clearing it — the field commits its last valid result.
  }, [expression, evaluated, onChangeValue]);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setExpression(value);
    }
  }, [value]);

  const displayValue = useMemo(() => {
    if (expression.trim() === '') return '';
    if (evaluated === null) return expression;
    // formatCurrencyInput strips anything but digits/'.', so a negative amount (the signed
    // initialBalance field, VL-04) needs its sign re-applied after formatting the magnitude.
    const negative = evaluated < 0n;
    const magnitude = negative ? -evaluated : evaluated;
    const formatted = formatCurrencyInput(formatMoneyCompact(magnitude, 0), true);
    return negative ? `-${formatted}` : formatted;
  }, [evaluated, expression]);

  // Android's back button, while this field owns the dock, closes the keypad before it can reach
  // a modal/screen's own back handling — the same order a real keyboard would resolve back in.
  useEffect(() => {
    if (Platform.OS !== 'android' || !focused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      inputRef.current?.blur();
      return true;
    });
    return () => subscription.remove();
  }, [focused]);

  useEffect(() => {
    if (!focused) {
      setDockedKeypad(idRef.current, null);
      return;
    }
    setDockedKeypad(
      idRef.current,
      <View style={{ gap: theme.spacing.sm }}>
        <View className="flex-row items-center justify-between">
          {HAS_OPERATOR.test(expression) ? (
            <Text variant="caption" tone="muted" numeric>
              {expression}
            </Text>
          ) : (
            <View />
          )}
          <Pressable
            testID={`${idRef.current}-done`}
            onPress={() => inputRef.current?.blur()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xxs,
              paddingVertical: theme.spacing.xxs,
              paddingHorizontal: theme.spacing.sm,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primaryMuted,
            }}
          >
            <Check size={14} color={theme.colors.primary} strokeWidth={2.5} />
            <Text variant="label" weight="semibold" style={{ color: theme.colors.primary }}>
              Done
            </Text>
          </Pressable>
        </View>
        <CalculatorKeypad
          expressionRef={expressionRef}
          onExpressionChange={setExpression}
          testID={`${idRef.current}-keypad`}
        />
      </View>,
    );
  }, [focused, expression, theme, setDockedKeypad]);

  // Unmounting (modal closed, navigated away) must never leave a stale keypad docked.
  useEffect(() => {
    const id = idRef.current;
    return () => setDockedKeypad(id, null);
  }, [setDockedKeypad]);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label !== undefined ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={inputRef}
        testID={testID}
        value={displayValue}
        // Native typing can't reach this field (the keyboard is suppressed below), so there is
        // nothing for a real onChangeText to ever report — the keypad is the only writer.
        onChangeText={() => {}}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        showSoftInputOnFocus={false}
        caretHidden={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        className="h-[48px]"
        style={{
          borderRadius: theme.radius.md,
          borderWidth: focused || hasError ? 1.5 : 1,
          borderColor: hasError ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
          color: theme.colors.text,
          fontSize: theme.fontSize.lg,
          fontFamily: theme.fontFamily.semibold,
        }}
      />
      {hasError ? (
        <Text variant="caption" tone="danger" testID={testID !== undefined ? `${testID}-error` : undefined}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
