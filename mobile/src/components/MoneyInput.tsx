import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, TextInput, View } from 'react-native';

import { formatMoney } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { hasOperator, tryEvaluate } from '@/utils';
import { CalculatorKeypad } from './CalculatorKeypad.tsx';
import { useKeyboardDock } from './KeyboardDockProvider.tsx';
import { useCalculatorExpression } from './useCalculatorExpression.ts';
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

  const { expression, setExpression, expressionRef, evaluated, display: displayValue } = useCalculatorExpression(value);
  const [focused, setFocused] = useState(false);
  // Same ref pattern as expressionRef, so CalculatorKeypadProps.onConfirmRef's identity stays
  // stable across renders even though what it does depends on the field's current focus/ref.
  const onConfirmRef = useRef(() => inputRef.current?.blur());
  onConfirmRef.current = () => inputRef.current?.blur();
  const message = Array.isArray(error) ? error[0] : error;
  const hasError = message !== undefined && message.length > 0;

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
    // An expression with an operator (e.g. "5+3" while typing "5+30") only commits when the user
    // taps the Done checkmark below — evaluating on every keystroke here would commit "5+3" the
    // instant it becomes syntactically valid, before the second "0" is even typed. A plain number
    // has no such intermediate false-complete state, so it can keep committing live.
    if (hasOperator(expression)) return;
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

  const commitExpression = () => {
    if (!hasOperator(expression)) return;
    const result = tryEvaluate(expression);
    if (result === null) return; // Incomplete (trailing operator) — leave it for more typing.
    const formatted = formatMoney(result);
    lastEmittedRef.current = formatted;
    setExpression(formatted);
    onChangeValue(formatted);
  };

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setExpression(value);
    }
  }, [value]);

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
      <CalculatorKeypad
        expressionRef={expressionRef}
        onExpressionChange={setExpression}
        onConfirmRef={onConfirmRef}
        testID={`${idRef.current}-keypad`}
      />,
    );
  }, [focused, setDockedKeypad]);

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
        onBlur={() => {
          // Losing focus any other way (tapping outside, the hardware back button) must commit
          // a pending operator expression too — otherwise the field would keep showing raw,
          // uncommitted text like "5+30" with the parent still holding the old value.
          commitExpression();
          setFocused(false);
        }}
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
