import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { buildTheme, THEME_MODES, THEME_NAMES, type Theme, type ThemeMode, type ThemeName } from '../../design-system/index';
import { authApi } from '@/services/api';
import { THEME_MODE_STORAGE_KEY, THEME_STORAGE_KEY, preferencesStore } from '@/services/storage';
import { useAuth } from './AuthProvider';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  themeMode: ThemeMode;
  setThemeName: (name: ThemeName) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_THEME: ThemeName = 'obsidian';
const DEFAULT_MODE: ThemeMode = 'dark';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'sora-theme-transition-styles';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.innerHTML = `
      * {
      *:not([role="switch"]):not([role="switch"] *) {
        transition: background-color 380ms cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 380ms cubic-bezier(0.4, 0, 0.2, 1),
                    color 380ms cubic-bezier(0.4, 0, 0.2, 1) !important;
                    color 380ms cubic-bezier(0.4, 0, 0.2, 1),
                    fill 380ms cubic-bezier(0.4, 0, 0.2, 1),
                    stroke 380ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

function isThemeName(value: string | null | undefined): value is ThemeName {
  return value !== null && value !== undefined && (THEME_NAMES as readonly string[]).includes(value);
}

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value !== null && value !== undefined && (THEME_MODES as readonly string[]).includes(value);
}

export interface AnimatedThemeRootHandle {
  /** Starts the cross-dissolve immediately, called synchronously from `setThemeMode`/
   * `setThemeName` before React has re-rendered anything — see the comment below. */
  beginTransition: (fromBackground: string) => void;
}

/**
 * On native, every descendant re-renders with the new theme's colors the
 * instant `theme` changes — there's nothing to animate per-component. So
 * instead of interpolating one color, a full-screen overlay holds the *old*
 * background and fades itself out, masking the instant switch underneath as
 * a single smooth cross-dissolve. Web instead gets a CSS transition on every
 * element (see the injected stylesheet above), so this overlay is
 * native-only.
 *
 * `ThemeContext`'s value changes on every mode/name switch, and ~90 call
 * sites read it via `useTheme()` — so the re-render this triggers can take
 * long enough to be perceptible before this component's own `theme` prop
 * ever updates. `beginTransition` lets `setThemeMode`/`setThemeName` start
 * the fade imperatively, synchronously, in the same tick as the press —
 * before that re-render even begins — so the (now-hidden, behind the
 * overlay) re-render cost is masked instead of gating the animation's start.
 * The `useLayoutEffect` below still exists as the fallback path for any
 * theme change *not* driven through those setters (initial hydration from
 * storage/server) — `pendingImperativeTrigger` stops it from re-firing a
 * second, duplicate fade for a change `beginTransition` already started.
 */
const AnimatedThemeRoot = forwardRef<AnimatedThemeRootHandle, { children: ReactNode; theme: Theme }>(
  function AnimatedThemeRoot({ children, theme }, ref) {
    const prevTheme = useRef<Theme>(theme);
    const pendingImperativeTrigger = useRef(false);
    const overlayOpacity = useSharedValue(0);
    const [overlayColor, setOverlayColor] = useState<string | null>(null);

    const fade = useCallback(
      (fromBackground: string) => {
        setOverlayColor(fromBackground);
        overlayOpacity.value = 1;
        overlayOpacity.value = withTiming(
          0,
          { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) },
          (finished) => {
            if (finished) runOnJS(setOverlayColor)(null);
          },
        );
      },
      [overlayOpacity],
    );

    useImperativeHandle(
      ref,
      () => ({
        beginTransition(fromBackground: string) {
          if (Platform.OS === 'web') return;
          pendingImperativeTrigger.current = true;
          fade(fromBackground);
        },
      }),
      [fade],
    );

    useLayoutEffect(() => {
      const alreadyTriggered = pendingImperativeTrigger.current;
      pendingImperativeTrigger.current = false;
      if (Platform.OS === 'web') return;
      if (prevTheme.current.mode === theme.mode && prevTheme.current.name === theme.name) return;

      const fromBackground = prevTheme.current.colors.background;
      prevTheme.current = theme;
      if (alreadyTriggered) return;
      fade(fromBackground);
    }, [theme, fade]);

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }));

    return (
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        {children}
        {overlayColor !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, zIndex: 99999 }, overlayStyle]}
          />
        ) : null}
      </View>
    );
  },
);

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth();
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const hydratedFromServer = useRef(false);
  const hydratedFromCache = useRef(false);
  const rootRef = useRef<AnimatedThemeRootHandle>(null);

  useEffect(() => {
    void Promise.all([
      preferencesStore.get(THEME_STORAGE_KEY),
      preferencesStore.get(THEME_MODE_STORAGE_KEY),
    ]).then(([cachedTheme, cachedMode]) => {
      hydratedFromCache.current = true;
      if (isThemeName(cachedTheme)) setThemeNameState(cachedTheme);
      if (isThemeMode(cachedMode)) setThemeModeState(cachedMode);
    });
  }, []);

  useEffect(() => {
    if (user === null || hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    if (isThemeName(user.theme) && user.theme !== themeName) {
      setThemeNameState(user.theme);
      void preferencesStore.set(THEME_STORAGE_KEY, user.theme);
    }
  }, [user, themeName]);

  const theme = useMemo(() => buildTheme(themeName, themeMode), [themeName, themeMode]);
  // A "latest theme" ref rather than closing over `theme` directly: `setThemeName`/`setThemeMode`
  // need the *previous* theme's background synchronously, at press time, without their own
  // identity changing on every theme change (they're `void`-fired from `onPress`/`onValueChange`,
  // so a fresh identity each render would still work, but this avoids recreating the closures).
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setThemeName = useMemo(
    () => async (next: ThemeName) => {
      const current = themeRef.current;
      if (next !== current.name) rootRef.current?.beginTransition(current.colors.background);
      setThemeNameState(next);
      await preferencesStore.set(THEME_STORAGE_KEY, next);
      if (user !== null) authApi.updatePreferences({ theme: next }).catch(() => undefined);
    },
    [user],
  );

  const setThemeMode = useMemo(
    () => async (next: ThemeMode) => {
      const current = themeRef.current;
      if (next !== current.mode) rootRef.current?.beginTransition(current.colors.background);
      setThemeModeState(next);
      await preferencesStore.set(THEME_MODE_STORAGE_KEY, next);
    },
    [],
  );

  const value = useMemo(
    () => ({ theme, themeName, themeMode, setThemeName, setThemeMode }),
    [theme, themeName, themeMode, setThemeName, setThemeMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <AnimatedThemeRoot ref={rootRef} theme={theme}>{children}</AnimatedThemeRoot>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('useTheme must be used inside ThemeProvider');
  return context.theme;
}

export function useThemeControl(): Omit<ThemeContextValue, 'theme'> {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('useThemeControl must be used inside ThemeProvider');
  const { theme: _theme, ...control } = context;
  return control;
}
