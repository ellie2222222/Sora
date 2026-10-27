import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { buildTheme, COLOR_TRANSITION_MS, THEME_MODES, THEME_NAMES, type Theme, type ThemeMode, type ThemeName } from '@/design-system';
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
      *:not([role="switch"]):not([role="switch"] *) {
        transition: background-color ${COLOR_TRANSITION_MS}ms ease-in-out,
                    border-color ${COLOR_TRANSITION_MS}ms ease-in-out,
                    color ${COLOR_TRANSITION_MS}ms ease-in-out,
                    fill ${COLOR_TRANSITION_MS}ms ease-in-out,
                    stroke ${COLOR_TRANSITION_MS}ms ease-in-out !important;
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

  // Web eases colours with the stylesheet above; Reduce Motion switches at once.
  const reduceMotion = useReducedMotion();
  const theme = useMemo(
    () => buildTheme(themeName, themeMode, reduceMotion || Platform.OS === 'web'),
    [themeName, themeMode, reduceMotion],
  );

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

  const value = useMemo(
    () => ({ theme, themeName, themeMode, setThemeName, setThemeMode }),
    [theme, themeName, themeMode, setThemeName, setThemeMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* Every themed element eases its own colours (theme.motion); this one is the backdrop the screens sit on. */}
      <Animated.View style={[{ flex: 1, backgroundColor: theme.colors.background }, theme.motion.colorTransition]}>
        {/* From the app's theme, not the phone's: "auto" left white status text on a light theme in system dark mode. */}
        <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} />
        {children}
      </Animated.View>
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
