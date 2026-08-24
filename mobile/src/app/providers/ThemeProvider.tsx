import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { buildTheme, THEME_NAMES, type Theme, type ThemeName } from '../../design-system/index.ts';
import { authApi } from '../../services/api/auth.ts';
import { THEME_STORAGE_KEY, preferencesStore } from '../../services/storage/preferencesStore.ts';
import { useAuth } from './AuthProvider.tsx';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_THEME: ThemeName = 'obsidian';

function isThemeName(value: string | null | undefined): value is ThemeName {
  return value !== null && value !== undefined && (THEME_NAMES as readonly string[]).includes(value);
}

/**
 * Must render inside AuthProvider — it reads `user.theme` to apply the
 * server's stored preference once, the first time a session is known, the
 * same hydrate-once pattern LocaleProvider uses (and for the same reason: a
 * returning user's device should show what they last chose, but this device's
 * own later choice should not keep being overwritten by a stale server value).
 *
 * The default is Obsidian regardless of the device's own light/dark setting —
 * unlike the dark/light toggle this replaced, the product spec calls for one
 * fixed default rather than following the system.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth();
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);
  const hydratedFromServer = useRef(false);
  const hydratedFromCache = useRef(false);

  useEffect(() => {
    void preferencesStore.get(THEME_STORAGE_KEY).then((cached) => {
      hydratedFromCache.current = true;
      if (isThemeName(cached)) setThemeNameState(cached);
    });
  }, []);

  useEffect(() => {
    if (user === null || hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    // A cached on-device choice (set before this user was known, e.g. a
    // previous session on a shared device) still loses to the server once a
    // user is confirmed — the server is the returning user's source of truth.
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

  const theme = useMemo(() => buildTheme(themeName), [themeName]);
  const value = useMemo(() => ({ theme, themeName, setThemeName }), [theme, themeName, setThemeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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
