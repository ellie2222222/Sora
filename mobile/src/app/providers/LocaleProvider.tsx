import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { bootstrapLocale, setCachedLocale, type SupportedLocale } from '@/app/i18n';
import { invalidateEverything, useAppDispatch } from '@/app/store';
import { authApi } from '@/services/api';
import { activeLocale, setActiveLocale } from '@/services/locale';
import { useAuth } from './AuthProvider.tsx';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Must render inside AuthProvider — it reads `user.locale` to apply the
 * server's stored preference once, the first time a session is known.
 *
 * Resolution order matches i18n/index.ts's bootstrapLocale: cached-or-device
 * locale renders immediately (never a blank/wrong-language flash), then the
 * server value (if the user is signed in and it differs) wins exactly once —
 * after that, this device's own choice is trusted, matching ThemeProvider's
 * identical hydrate-once pattern.
 */
export function LocaleProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const hydratedFromServer = useRef(false);
  // Requests sent before the saved language loads go out in activeLocale()'s default, so a different one refetches them.
  const appliedLocale = useRef<SupportedLocale>(activeLocale());

  // Cached reads carry category names in the language they were fetched in, so a switch refetches them.
  const applyLocale = useCallback(
    (next: SupportedLocale) => {
      setActiveLocale(next);
      if (appliedLocale.current !== next) {
        dispatch(invalidateEverything());
      }
      appliedLocale.current = next;
      setLocaleState(next);
    },
    [dispatch],
  );

  useEffect(() => {
    void bootstrapLocale().then(applyLocale);
  }, [applyLocale]);

  useEffect(() => {
    if (user === null || hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    if (user.locale !== locale) void setCachedLocale(user.locale).then(() => applyLocale(user.locale));
  }, [user, locale, applyLocale]);

  const setLocale = useMemo(
    () => async (next: SupportedLocale) => {
      await setCachedLocale(next);
      applyLocale(next);
      if (user !== null) {
        // Best-effort: a returning user should see the same language on
        // another device, but a failed sync must not block switching it here.
        authApi.updatePreferences({ locale: next }).catch(() => undefined);
      }
    },
    [user, applyLocale],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleControl(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === null) throw new Error('useLocaleControl must be used inside LocaleProvider');
  return context;
}
