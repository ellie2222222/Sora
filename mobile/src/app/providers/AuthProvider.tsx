import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GoogleAuthRequest, LoginRequest, RegisterRequest, UserResponse } from '@finance/contracts';

import { authApi } from '../../services/api/auth.ts';
import { session, type StoredSession } from '../../services/auth/index.ts';

/**
 * `restoring` exists so the root navigator can render nothing until the stored
 * session has been read. Without it the app mounts the auth stack first and a
 * signed-in user sees the login screen flash before being redirected.
 */
interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  restoring: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (details: RegisterRequest) => Promise<void>;
  loginWithGoogle: (body: GoogleAuthRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [stored, setStored] = useState<StoredSession | null>(session.current());
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    // Subscribing before restoring means a refresh that fails during startup
    // (revoked token) still clears this state rather than leaving the app
    // believing it is signed in.
    const unsubscribe = session.subscribe(setStored);

    let cancelled = false;
    void (async () => {
      const restored = await session.restore();
      if (restored !== null) {
        try {
          const me = await authApi.me();
          if (!cancelled) setUser(me);
        } catch {
          // The refresh token may have been revoked while the app was closed.
          // The interceptor has already cleared the session; land on login.
          await session.clear();
        }
      }
      if (!cancelled) setRestoring(false);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const result = await authApi.login(credentials);
      await session.adopt(result.tokens);
      setUser(result.user);
    },
    [],
  );

  const register = useCallback(async (details: RegisterRequest) => {
    const result = await authApi.register(details);
    await session.adopt(result.tokens);
    setUser(result.user);
  }, []);

  const loginWithGoogle = useCallback(async (body: GoogleAuthRequest) => {
    const result = await authApi.google(body);
    await session.adopt(result.tokens);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session.current()?.refreshToken;
    try {
      await authApi.logout(refreshToken);
    } catch {
      // A failed logout must still sign the user out locally; the alternative
      // is a user who cannot leave a shared device because the network is down.
    }
    await session.clear();
    setUser(null);
    // Another account's wallets must never be served from this cache.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: stored !== null,
      restoring,
      login,
      register,
      loginWithGoogle,
      logout,
    }),
    [user, stored, restoring, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
