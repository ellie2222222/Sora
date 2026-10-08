import { Check, CircleAlert, Pause } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { useSvgId } from './useSvgId.ts';
import type { UploadPhase } from '@/services/guest';

/** `halted`: the step the upload stopped on, shown with why (paused or failed) rather than a spinner. */
export type UploadStepState = 'done' | 'active' | 'halted' | 'queued';

const STEP_LABEL_KEYS: Record<UploadPhase, string> = {
  categories: 'guest.upload.stepCategories',
  accounts: 'guest.upload.stepAccounts',
  goals: 'guest.upload.stepGoals',
  transactions: 'guest.upload.stepTransactions',
  budgets: 'guest.upload.stepBudgets',
  archives: 'guest.upload.stepArchives',
};

const SPINNER_ARC = 0.28;
/** The highlight crossing the running row, as a share of the row. */
const ROW_SHIMMER_SHARE = 0.3;
const BURST_START_OPACITY = 0.6;
const GLOW_REST = 0.35;
const SHIMMER_PEAK_OPACITY = 0.12;
const CARD_TOP_OPACITY = 0.9;

interface UploadStepsCardProps {
  /** `count` is the step's rows done / total, already formatted. */
  steps: readonly { phase: UploadPhase; state: UploadStepState; count: string }[];
  haltedBecause: 'paused' | 'failed';
}

export function UploadStepsCard({ steps, haltedBecause }: UploadStepsCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const gradientId = useSvgId('uploadCard');
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    // The shadow sits on an outer layer: iOS clips a shadow on the view that clips its content.
    <View style={{ alignSelf: 'stretch', borderRadius: theme.radius.xxl, backgroundColor: theme.colors.surface, ...theme.shadows.lg }}>
      <View
        testID="list-guest-upload-steps"
        onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        style={{
          borderRadius: theme.radius.xxl,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.border,
          borderTopColor: theme.colors.borderStrong,
          padding: theme.spacing.sm,
          gap: theme.spacing.xxs,
          overflow: 'hidden',
        }}
      >
        <Svg pointerEvents="none" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.surfaceElevated} stopOpacity={CARD_TOP_OPACITY} />
              <Stop offset="1" stopColor={theme.colors.surface} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
        {steps.map(({ phase, state, count }) => (
          <UploadStepRow key={phase} phase={phase} label={t(STEP_LABEL_KEYS[phase])} count={count} state={state} haltedBecause={haltedBecause} />
        ))}
      </View>
    </View>
  );
}

function UploadStepRow({
  phase,
  label,
  count,
  state,
  haltedBecause,
}: {
  phase: UploadPhase;
  label: string;
  count: string;
  state: UploadStepState;
  haltedBecause: 'paused' | 'failed';
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const shimmerId = useSvgId('uploadRowShimmer');
  const previous = useRef(state);
  const [{ width: rowWidth, height: rowHeight }, setRowSize] = useState({ width: 0, height: 0 });

  const lit = useSharedValue(state === 'active' ? 1 : 0);
  const spinnerShown = useSharedValue(state === 'active' ? 1 : 0);
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const check = useSharedValue(state === 'done' ? 1 : 0);
  // 1 is the resting state: no ring until this row completes.
  const burst = useSharedValue(1);
  const settled = useSharedValue(state === 'done' ? 1 : 0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    const animate = !reduceMotion && was !== state;

    if (state === 'active') {
      lit.value = animate ? withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }) : 1;
      // Waits for the previous row's check, so the eye follows done → next rather than both at once.
      spinnerShown.value = animate ? withDelay(160, withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })) : 1;
      check.value = 0;
      settled.value = 0;
      return;
    }

    lit.value = animate ? withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }) : 0;
    if (state === 'done' && was === 'active' && animate) {
      spin.value = withTiming(spin.value + 0.6, { duration: 160, easing: Easing.in(Easing.quad) });
      spinnerShown.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });
      check.value = withDelay(110, withSpring(1, { damping: 11, stiffness: 340, mass: 0.6 }));
      burst.value = 0;
      burst.value = withDelay(110, withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }));
      settled.value = withDelay(260, withTiming(1, { duration: 200 }));
    } else {
      spinnerShown.value = 0;
      check.value = state === 'done' ? 1 : 0;
      settled.value = state === 'done' ? 1 : 0;
    }
  }, [state, reduceMotion]);

  const running = state === 'active' && !reduceMotion;
  useEffect(() => {
    if (!running) {
      cancelAnimation(breathe);
      cancelAnimation(sweep);
      breathe.value = 0;
      sweep.value = 0;
      return;
    }
    spin.value = withRepeat(withTiming(spin.value + 1, { duration: 900, easing: Easing.linear }), -1);
    breathe.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
    sweep.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 900 })), -1);
    return () => cancelAnimation(spin);
  }, [running]);

  const capsuleStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lit.value * interpolate(breathe.value, [0, 1], [GLOW_REST, 1]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.85, 1.1]) }],
  }));
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerShown.value,
    transform: [{ rotate: `${spin.value * 360}deg` }, { scale: interpolate(spinnerShown.value, [0, 1], [0.6, 1]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, check.value * 2), transform: [{ scale: check.value }] }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value >= 1 ? 0 : interpolate(burst.value, [0, 1], [BURST_START_OPACITY, 0]),
    transform: [{ scale: interpolate(burst.value, [0, 1], [0.6, 1.9]) }],
  }));
  const shimmerWidth = rowWidth * ROW_SHIMMER_SHARE;
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -shimmerWidth + (rowWidth + shimmerWidth) * sweep.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color:
      state === 'queued'
        ? theme.colors.textFaint
        : interpolateColor(settled.value, [0, 1], [theme.colors.text, theme.colors.textMuted]),
  }));

  const box = theme.sizes.badge.sm;
  const spinnerSize = theme.iconSize.xl;
  const spinnerRadius = (spinnerSize - theme.iconStroke.regular) / 2;
  const spinnerCircumference = 2 * Math.PI * spinnerRadius;

  return (
    <View
      testID={`row-guest-upload-step-${phase}`}
      accessibilityState={{ busy: state === 'active' }}
      onLayout={(event) => setRowSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.borderStrong,
            backgroundColor: theme.colors.primaryMuted,
          },
          capsuleStyle,
        ]}
      />
      {running && shimmerWidth > 0 && rowHeight > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: shimmerWidth, height: rowHeight }, shimmerStyle]}>
          <Svg width={shimmerWidth} height={rowHeight}>
            <Defs>
              <LinearGradient id={shimmerId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={theme.colors.text} stopOpacity={0} />
                <Stop offset="0.5" stopColor={theme.colors.text} stopOpacity={SHIMMER_PEAK_OPACITY} />
                <Stop offset="1" stopColor={theme.colors.text} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={shimmerWidth} height={rowHeight} fill={`url(#${shimmerId})`} />
          </Svg>
        </Animated.View>
      ) : null}

      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: box, height: box, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primaryMuted }, glowStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', width: box, height: box, borderRadius: theme.radius.pill, borderWidth: theme.borderWidth.medium, borderColor: theme.colors.success },
            burstStyle,
          ]}
        />
        {state === 'queued' ? (
          <View style={{ width: theme.sizes.dot.md, height: theme.sizes.dot.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.borderStrong }} />
        ) : state === 'halted' ? (
          haltedBecause === 'failed' ? (
            <CircleAlert size={theme.iconSize.lg} color={theme.colors.warning} />
          ) : (
            <Pause size={theme.iconSize.lg} color={theme.colors.textMuted} />
          )
        ) : null}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, spinnerStyle]}>
          <Svg width={spinnerSize} height={spinnerSize}>
            <Circle
              cx={spinnerSize / 2}
              cy={spinnerSize / 2}
              r={spinnerRadius}
              stroke={theme.colors.primary}
              strokeWidth={theme.iconStroke.regular}
              strokeLinecap="round"
              strokeDasharray={`${spinnerCircumference * SPINNER_ARC} ${spinnerCircumference}`}
              fill="none"
            />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, checkStyle]}>
          <Check size={theme.iconSize.lg} color={theme.colors.success} strokeWidth={theme.iconStroke.bold} />
        </Animated.View>
      </View>

      <Animated.Text
        numberOfLines={1}
        style={[
          {
            flex: 1,
            fontFamily: state === 'active' ? theme.fontFamily.semibold : theme.fontFamily.medium,
            fontSize: theme.fontSize.md,
          },
          labelStyle,
        ]}
      >
        {label}
      </Animated.Text>
      <Text
        variant="label"
        numeric
        testID={`guest-upload-step-count-${phase}`}
        tone={state === 'active' ? 'default' : state === 'queued' ? 'faint' : 'muted'}
      >
        {count}
      </Text>
    </View>
  );
}
