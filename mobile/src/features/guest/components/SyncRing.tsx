import { CloudUpload } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/app/providers';
import { useSvgId } from './useSvgId.ts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GLOW_REST = 0.55;
const GLOW_PEAK = 1;
const GLOW_CENTRE_OPACITY = 0.22;
const COMET_HEAD = 0.07;
const COMET_TAIL = 0.2;
const COMET_TAIL_OPACITY = 0.3;
/** Horizontal drift and start delay of each mote in a completion burst, as fractions of the ring. */
const MOTES = [
  { drift: -0.16, delay: 0 },
  { drift: 0.1, delay: 0.12 },
  { drift: 0.02, delay: 0.24 },
] as const;

interface SyncRingProps {
  /** Rows uploaded so far, 0–1. */
  fraction: number;
  /** Motion runs only while the upload does, so a still ring means nothing is being sent. */
  active: boolean;
  /** Changes when a step completes, sending a few motes up from the centre. */
  burstKey: number;
}

/**
 * The upload screen's centrepiece. The arc is the real share of rows uploaded; the
 * circling comet only says "still working", so it stops the moment the upload does.
 */
export function SyncRing({ fraction, active, burstKey }: SyncRingProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const gradientId = useSvgId('syncRingGlow');
  const { size, stroke, glow } = theme.sizes.syncRing;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  const progress = useSharedValue(fraction);
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  // 1 is the resting state: no motes until a step completes.
  const burst = useSharedValue(1);

  useEffect(() => {
    progress.value = reduceMotion ? fraction : withTiming(fraction, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [fraction, reduceMotion]);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(spin);
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1);
    breathe.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [active, reduceMotion]);

  useEffect(() => {
    if (burstKey === 0 || reduceMotion) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [burstKey, reduceMotion]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  const cometStyle = useAnimatedStyle(() => ({
    opacity: active && !reduceMotion ? GLOW_PEAK : 0,
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [GLOW_REST, GLOW_PEAK]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.94, 1.04]) }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: glow, height: glow, top: (size - glow) / 2, left: (size - glow) / 2 }, glowStyle]}
      >
        <Svg width={glow} height={glow}>
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={active ? GLOW_CENTRE_OPACITY : 0} />
              <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>

      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={centre} cy={centre} r={radius} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={active ? theme.colors.primary : theme.colors.textMuted}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
          fill="none"
        />
      </Svg>

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, cometStyle]}>
        <Svg width={size} height={size}>
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={theme.colors.primary}
            strokeOpacity={COMET_TAIL_OPACITY}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * COMET_TAIL} ${circumference}`}
            fill="none"
          />
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            // A bright lead on the dark ring; on a light one, text colour would read as a dark smudge.
            stroke={theme.mode === 'dark' ? theme.colors.text : theme.colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * COMET_HEAD} ${circumference}`}
            strokeDashoffset={-circumference * (COMET_TAIL - COMET_HEAD)}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {MOTES.map((mote, index) => (
        <Mote key={index} burst={burst} drift={mote.drift * size} delay={mote.delay} rise={size / 2} />
      ))}

      <CloudUpload size={theme.iconSize.hero} color={active ? theme.colors.primary : theme.colors.textMuted} strokeWidth={theme.iconStroke.thin} />
    </View>
  );
}

function Mote({ burst, drift, delay, rise }: { burst: SharedValue<number>; drift: number; delay: number; rise: number }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (burst.value - delay) / (1 - delay)));
    return {
      opacity: burst.value >= 1 ? 0 : interpolate(local, [0, 0.2, 1], [0, GLOW_PEAK, 0]),
      transform: [{ translateY: -rise * local }, { translateX: drift * local }, { scale: interpolate(local, [0, 1], [1, 0.4]) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: theme.sizes.dot.sm,
          height: theme.sizes.dot.sm,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
        },
        style,
      ]}
    />
  );
}
