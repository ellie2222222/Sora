import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/**
 * On native, every descendant re-renders with the new theme's colors the
 * instant `theme` changes — there's nothing to animate per-component. So
 * instead of interpolating one color, a full-screen overlay holds the *old*
 * background and fades itself out, masking the instant switch underneath as
 * a single smooth cross-dissolve. Web instead gets a CSS transition on every
 * element (see the injected stylesheet above), so this overlay is
 * native-only.
 */
function AnimatedThemeRoot({ children, theme }: { children: ReactNode; theme: Theme }) {
  const prevTheme = useRef<Theme>(theme);
  const overlayOpacity = useSharedValue(0);
  const [overlayColor, setOverlayColor] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (Platform.OS === 'web') return;
    if (prevTheme.current.mode === theme.mode && prevTheme.current.name === theme.name) return;

    setOverlayColor(prevTheme.current.colors.background);
    prevTheme.current = theme;
    overlayOpacity.value = 1;
    overlayOpacity.value = withTiming(
      0,
      { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) },
      (finished) => {
        if (finished) runOnJS(setOverlayColor)(null);
      },
    );
  }, [theme, overlayOpacity]);

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
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth();
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const hydratedFromServer = useRef(false);
  const hydratedFromCache = useRef(false);

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

  const setThemeName = useMemo(
    () => async (next: ThemeName) => {
      setThemeNameState(next);
      await preferencesStore.set(THEME_STORAGE_KEY, next);
      if (user !== null) authApi.updatePreferences({ theme: next }).catch(() => undefined);
    },
    [user],
  );

  const setThemeMode = useMemo(
    () => async (next: ThemeMode) => {
      setThemeModeState(next);
      await preferencesStore.set(THEME_MODE_STORAGE_KEY, next);
    },
    [],
  );

  const theme = useMemo(() => buildTheme(themeName, themeMode), [themeName, themeMode]);
  const value = useMemo(
    () => ({ theme, themeName, themeMode, setThemeName, setThemeMode }),
    [theme, themeName, themeMode, setThemeName, setThemeMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <AnimatedThemeRoot theme={theme}>{children}</AnimatedThemeRoot>
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
