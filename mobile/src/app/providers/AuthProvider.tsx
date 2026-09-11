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
import type { GoogleAuthRequest, LoginRequest, RegisterRequest, UserResponse } from '@sora/contracts';

import { authApi } from '../../services/api/auth.ts';
import { session, type StoredSession } from '../../services/auth/index.ts';
import { ensureSeeded } from '../../services/guest/guestSeed.ts';
import { guestStore } from '../../services/guest/guestStorage.ts';
import { uploadGuestData } from '../../services/guest/guestUpload.ts';
import { GUEST_MODE_STORAGE_KEY, preferencesStore } from '../../services/storage/preferencesStore.ts';
import { setIsGuest as setIsGuestInStore } from '../store/authSlice.ts';
import { useAppDispatch } from '../store/hooks.ts';

/**
 * `restoring` exists so the root navigator can render nothing until the stored
 * session (and the guest-mode flag) has been read. Without it the app mounts
 * the auth stack first and a signed-in — or guest — user sees the login
 * screen flash before being redirected.
 */
interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  restoring: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (details: RegisterRequest) => Promise<void>;
  loginWithGoogle: (body: GoogleAuthRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** True once `enterGuestMode()` has run and stays true across a relaunch. */
  isGuest: boolean;
  enterGuestMode: () => Promise<void>;
  /** Drops back to the auth stack without discarding local guest data. */
  exitGuestModeToAuth: () => Promise<void>;
  /**
   * A real login/register landed while local guest data still exists — the
   * root navigator renders the upload-resolution screen instead of the app
   * while this is true. Computed from `guestStore`, not stored, so an app
   * kill mid-upload leaves this recoverable rather than stuck.
   */
  pendingGuestUpload: boolean;
  resolveGuestUpload: (walletId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [stored, setStored] = useState<StoredSession | null>(session.current());
  const [restoring, setRestoring] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestHasData, setGuestHasData] = useState(false);

  // Mirrored into Redux so RTK Query `queryFn` endpoints — which only see
  // Redux state — can branch guest vs. real the same way this context's
  // consumers do. Remove once auth itself moves into the store (phase 3).
  useEffect(() => {
    dispatch(setIsGuestInStore(isGuest));
  }, [isGuest, dispatch]);

  useEffect(() => {
    // Subscribing before restoring means a refresh that fails during startup
    // (revoked token) still clears this state rather than leaving the app
    // believing it is signed in.
    const unsubscribe = session.subscribe(setStored);
    const unsubscribeGuest = guestStore.subscribe((data) => setGuestHasData(data.wallet !== null));

    let cancelled = false;
    void (async () => {
      const [restored, guestData, guestFlag] = await Promise.all([
        session.restore(),
        guestStore.hydrate(),
        preferencesStore.get(GUEST_MODE_STORAGE_KEY),
      ]);
      if (!cancelled) {
        setGuestHasData(guestData.wallet !== null);
        setIsGuest(guestFlag === 'true');
      }

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
      unsubscribeGuest();
    };
  }, []);

  const enterGuestMode = useCallback(async () => {
    await ensureSeeded();
    await preferencesStore.set(GUEST_MODE_STORAGE_KEY, 'true');
    setIsGuest(true);
  }, []);

  const exitGuestModeToAuth = useCallback(async () => {
    await preferencesStore.remove(GUEST_MODE_STORAGE_KEY);
    setIsGuest(false);
    // The guest and signed-in paths share query keys, so locally-served guest
    // entries must not survive into the real account's cache — the same
    // reasoning as logout's clear().
    queryClient.clear();
  }, [queryClient]);

  const resolveGuestUpload = useCallback(
    async (walletId: string) => {
      await uploadGuestData(walletId);
      await guestStore.clear();
      // Anything cached under a guest local id is now stale: the same records
      // exist server-side under different ids.
      queryClient.clear();
    },
    [queryClient],
  );

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
      isGuest,
      enterGuestMode,
      exitGuestModeToAuth,
      pendingGuestUpload: stored !== null && guestHasData,
      resolveGuestUpload,
    }),
    [
      user,
      stored,
      restoring,
      login,
      register,
      loginWithGoogle,
      logout,
      isGuest,
      enterGuestMode,
      exitGuestModeToAuth,
      guestHasData,
      resolveGuestUpload,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
