import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type AccessibilityActionEvent } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/app/providers';
import { hapticReveal, hapticTap, hapticWarning } from '@/services/haptics';
import { Text } from '../Text.tsx';
import { claimOpenSwipeRow, releaseOpenSwipeRow, type SwipeRowHandle } from './openSwipeRow.ts';
import { useScreenReaderEnabled } from './useScreenReaderEnabled.ts';

/** Past this much drag a release snaps open; short of it the row springs back. */
const OPEN_THRESHOLD = 40;
/** The row trails the finger slightly, so a short sideways wobble while scrolling doesn't reveal it. */
const FRICTION = 1.5;

export interface SwipeRowAction {
  /** Also the screen-reader action name, so it must be unique within the row. */
  key: string;
  label: string;
  icon: LucideIcon;
  tone: 'primary' | 'danger';
  onPress: () => void;
  testID?: string;
}

export interface SwipeableRowProps {
  /** Empty when the caller may do nothing to this row: it then renders as a plain row, no gesture. */
  actions: readonly SwipeRowAction[];
  children: ReactNode;
  /** Covers the action panel while closed; match whatever the row sits on. Cards bring their own. */
  backgroundColor?: string;
  /** The row's own corner radius, so the revealed panel is clipped to the same shape. */
  radius?: number;
  /** The row's own tap, offered as the default action when a screen reader merges the row into one element. */
  onActivate?: () => void;
}

/**
 * Swipe left to reveal the row's actions. One row is open at a time app-wide, tapping the open
 * row closes it, and the same actions are offered to screen readers, which can't swipe.
 */
export function SwipeableRow({ actions, children, backgroundColor, radius = 0, onActivate }: SwipeableRowProps) {
  const theme = useTheme();
  const screenReader = useScreenReaderEnabled();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const handle = useMemo<SwipeRowHandle>(() => ({ close: () => swipeableRef.current?.close() }), []);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  // Mounted only while the row is opening or open: the library keeps closed actions at opacity 0,
  // where a screen reader or an E2E selector would still find every row's Delete.
  const [revealed, setRevealed] = useState(false);
  const isOpenRef = useRef(false);

  // A row removed while open must not stay the claimed one.
  useEffect(() => () => releaseOpenSwipeRow(handle), [handle]);

  // Losing its actions while open (a role change, a refetch) unmounts the swipeable with no close event.
  const hasActions = actions.length > 0;
  useEffect(() => {
    if (hasActions) return;
    releaseOpenSwipeRow(handle);
    isOpenRef.current = false;
    setRevealed(false);
  }, [hasActions, handle]);

  if (!hasActions) return <>{children}</>;

  const choose = (action: SwipeRowAction) => {
    if (action.tone === 'danger') hapticWarning();
    else hapticTap();
    swipeableRef.current?.close();
    action.onPress();
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === 'activate') {
      onActivate?.();
      return;
    }
    actions.find((candidate) => candidate.key === name)?.onPress();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={FRICTION}
      rightThreshold={OPEN_THRESHOLD}
      overshootRight={false}
      containerStyle={{ borderRadius: radius, overflow: 'hidden' }}
      onSwipeableOpenStartDrag={() => setRevealed(true)}
      onSwipeableWillOpen={() => {
        setRevealed(true);
        // An open row nudged and released snaps open again; that is not a new reveal.
        if (isOpenRef.current) return;
        isOpenRef.current = true;
        claimOpenSwipeRow(handle);
        hapticReveal();
      }}
      onSwipeableWillClose={() => {
        isOpenRef.current = false;
      }}
      onSwipeableClose={() => {
        setRevealed(false);
        releaseOpenSwipeRow(handle);
      }}
      renderRightActions={() => (
        <View className="flex-row" style={{ width: theme.sizes.swipeAction * actions.length }}>
          {revealed && actions.map((action) => {
            const fill = action.tone === 'danger' ? theme.colors.danger : theme.colors.primary;
            const ink = action.tone === 'danger' ? theme.colors.onDanger : theme.colors.onPrimary;
            const Icon = action.icon;
            return (
              <Pressable
                key={action.key}
                testID={action.testID}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => choose(action)}
                onPressIn={() => setPressedKey(action.key)}
                onPressOut={() => setPressedKey(null)}
                style={{
                  width: theme.sizes.swipeAction,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.xxs,
                  backgroundColor: fill,
                  opacity: pressedKey === action.key ? theme.opacity.pressed : 1,
                }}
              >
                <Icon size={theme.iconSize.xl} color={ink} />
                <Text variant="caption" weight="semibold" numberOfLines={1} style={{ color: ink }}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {/* Only merged while a screen reader runs: otherwise the row's own controls stay separately addressable. */}
      <View
        accessible={screenReader}
        accessibilityActions={
          screenReader
            ? [
                ...(onActivate !== undefined ? [{ name: 'activate' }] : []),
                ...actions.map((action) => ({ name: action.key, label: action.label })),
              ]
            : undefined
        }
        onAccessibilityAction={screenReader ? onAccessibilityAction : undefined}
        style={{ backgroundColor: backgroundColor ?? 'transparent' }}
      >
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}
