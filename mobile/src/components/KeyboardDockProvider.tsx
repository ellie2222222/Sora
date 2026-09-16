import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/app/providers';

interface KeyboardDockContextValue {
  /** `node: null` unregisters — only ever applied if `id` still owns the dock, so a field that
   * already lost focus can't clear whatever field focused after it. */
  setDockedKeypad: (id: string, node: ReactNode | null) => void;
}

const KeyboardDockContext = createContext<KeyboardDockContextValue | null>(null);

export function useKeyboardDock(): KeyboardDockContextValue {
  const ctx = useContext(KeyboardDockContext);
  if (ctx === null) {
    throw new Error('useKeyboardDock must be called under a KeyboardDockProvider');
  }
  return ctx;
}

/**
 * Docks a focused `MoneyInput`'s calculator keypad at the bottom of whatever renders this
 * provider (a `BottomSheetModal` or a plain screen) — the same conceptual slot the native
 * keyboard would occupy, so at most one field's keypad is ever docked at a time.
 */
export function KeyboardDockProvider({
  children,
  applySafeArea = true,
}: {
  children: ReactNode;
  /** False inside a `BottomSheetModal`, which already reserves its own bottom safe-area space. */
  applySafeArea?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ownerIdRef = useRef<string | null>(null);
  const [node, setNode] = useState<ReactNode | null>(null);

  // Stable across renders — a consumer's effect depends on this, and a fresh reference every
  // render (the original bug here) re-fires that effect forever while a field stays focused,
  // since each fire hands the provider a referentially-new element and never lets React bail out.
  const setDockedKeypad = useCallback((id: string, next: ReactNode | null) => {
    if (next === null) {
      if (ownerIdRef.current === id) {
        ownerIdRef.current = null;
        setNode(null);
      }
      return;
    }
    ownerIdRef.current = id;
    setNode(next);
  }, []);

  const contextValue = useMemo(() => ({ setDockedKeypad }), [setDockedKeypad]);

  return (
    <KeyboardDockContext.Provider value={contextValue}>
      {/* flexShrink/minHeight: 0 so this area actually shrinks to make room for the docked keypad
       * below it instead of overflowing past the ancestor's maxHeight — web's real CSS flexbox
       * defaults min-height to `auto` on a flex item (refusing to shrink below content size) where
       * native Yoga doesn't have that quirk, which is why this only showed up on web. */}
      <View style={{ flexShrink: 1, minHeight: 0 }}>{children}</View>
      {node !== null ? (
        <Animated.View
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(200)}
          // flexShrink: 0 — CSS flexbox (unlike Yoga) defaults flex-shrink to 1, so without this the
          // keypad itself would be the thing getting squeezed on web instead of the content above it.
          style={{
            flexShrink: 0,
            paddingTop: theme.spacing.sm,
            paddingBottom: applySafeArea ? Math.max(insets.bottom, theme.spacing.sm) : undefined,
          }}
        >
          {node}
        </Animated.View>
      ) : null}
    </KeyboardDockContext.Provider>
  );
}
