import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthTokens, GoogleAuthRequest, LoginRequest, RegisterRequest, UserResponse } from '@sora/contracts';

import { authApi } from '@/services/api';
import { session, userIdFromAccessToken, type StoredSession } from '@/services/auth';
import { ensureSeeded, guestStore, guestUploadTask, uploadGuestData } from '@/services/guest';
import { GUEST_MODE_STORAGE_KEY, PRE_OWNERSHIP_OWNER_STORAGE_KEY, preferencesStore } from '@/services/storage';
import { localCache, maskEmail, offlineQueue, ORPHANED_OWNER } from '@/services/sync';
import { isNetworkError, isUnauthenticated } from '@/utils';
import { apiSlice, setIsGuest as setIsGuestInStore, useAppDispatch } from '@/app/store';

/**
 * `restoring` exists so the root navigator can show a spinner until the stored
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
  /** As above, but the user sent the upload (running or paused) to the background: the app shows. */
  guestUploadInBackground: boolean;
  /** Starts or resumes the upload into `walletId` on `guestUploadTask`; local data is cleared once it all lands. */
  startGuestUpload: (walletId: string) => void;
  /** Masked emails of other accounts whose saved data is on this device, set by a login that found some. */
  otherAccountNotice: string[] | null;
  dismissOtherAccountNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Points the read cache and the offline queue at the session's account before any
 * screen reads, so the first responses after a login are saved under it. From the
 * token, not `/me`, because an offline start never loads the user.
 */
function adoptDeviceOwner(next: StoredSession | null): void {
  const ownerId = next === null ? null : userIdFromAccessToken(next.accessToken);
  localCache.setOwner(ownerId);
  void offlineQueue.setOwner(ownerId);
}

/** Against the session persisted before this launch, never a login made during it (`resolvePreOwnershipRows`). */
function resolvePreOwnershipQueue(restored: StoredSession | null): void {
  const restoredUserId = restored === null ? null : userIdFromAccessToken(restored.accessToken);
  const decisions = {
    read: () => preferencesStore.get(PRE_OWNERSHIP_OWNER_STORAGE_KEY),
    write: (owner: string) => preferencesStore.set(PRE_OWNERSHIP_OWNER_STORAGE_KEY, owner),
  };
  offlineQueue.resolvePreOwnershipRows(restoredUserId, decisions).then(
    ({ owner, count }) => {
      if (owner === ORPHANED_OWNER && count > 0) {
        console.warn(`[offline-queue] ${count} change(s) queued before per-account ownership have no restored session to vouch for them; kept on this device, never synced.`);
      }
    },
    () => {
      console.warn('[offline-queue] Changes queued before per-account ownership could not be assigned this launch; they stay unsynced and keep this launch\'s owner.');
    },
  );
}

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [stored, setStored] = useState<StoredSession | null>(session.current());
  const [restoring, setRestoring] = useState(true);
  const [isGuest, setIsGuestState] = useState(false);
  const [guestHasData, setGuestHasData] = useState(false);
  const [uploadInBackground, setUploadInBackground] = useState(guestUploadTask.current().inBackground);
  const [otherAccountNotice, setOtherAccountNotice] = useState<string[] | null>(null);

  // RTK Query `queryFn` endpoints see only Redux state, so Redux takes the flag first, before the
  // re-render: copied in an effect, it landed after the guest screens' own effects had already
  // started their queries, which then went to the API with no session.
  const setIsGuest = useCallback(
    (value: boolean) => {
      dispatch(setIsGuestInStore(value));
      setIsGuestState(value);
    },
    [dispatch],
  );

  const clearServerCache = useCallback(() => {
    dispatch(apiSlice.util.resetApiState());
  }, [dispatch]);

  // A failed refresh ends the session without going through logout().
  useEffect(() => {
    if (stored === null) {
      clearServerCache();
      // The upload writes as this session; the next one picks its own wallet.
      guestUploadTask.reset();
    }
  }, [stored, clearServerCache]);

  useEffect(() => guestUploadTask.subscribe((task) => setUploadInBackground(task.inBackground)), []);

  useEffect(() => {
    // Subscribing before restoring means a refresh that fails during startup
    // (revoked token) still clears this state rather than leaving the app
    // believing it is signed in.
    const unsubscribe = session.subscribe((next) => {
      adoptDeviceOwner(next);
      setStored(next);
    });
    adoptDeviceOwner(session.current());
    const unsubscribeGuest = guestStore.subscribe((data) => setGuestHasData(data.wallet !== null));

    let cancelled = false;
    void (async () => {
      const [restored, guestData, guestFlag] = await Promise.all([
        session.restore(),
        guestStore.hydrate(),
        preferencesStore.get(GUEST_MODE_STORAGE_KEY),
      ]);
      resolvePreOwnershipQueue(restored);
      if (!cancelled) {
        setGuestHasData(guestData.wallet !== null);
        setIsGuest(guestFlag === 'true');
      }

      if (restored !== null) {
        try {
          const me = await authApi.me();
          // Advisory, as in signIn: a local storage failure must not fail a restore that succeeded.
          void localCache.rememberAccount({ userId: me.id, email: me.email }).catch(() => undefined);
          if (!cancelled) setUser(me);
        } catch (err: unknown) {
          if (isNetworkError(err)) {
            // Server connection unavailable, but user has valid stored tokens.
            // Retain local session so app remains usable offline.
          } else if (isUnauthenticated(err)) {
            // Token revoked/expired: clear session and return to login.
            await session.clear();
          } else {
            // Other server errors: retain session locally so cached data works.
          }
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
  }, [setIsGuest]);

  const exitGuestModeToAuth = useCallback(async () => {
    await preferencesStore.remove(GUEST_MODE_STORAGE_KEY);
    setIsGuest(false);
    // The guest and signed-in paths share query keys, so locally-served guest
    // entries must not survive into the real account's cache — the same
    // reasoning as logout's reset.
    clearServerCache();
  }, [clearServerCache, setIsGuest]);

  const startGuestUpload = useCallback(
    (walletId: string) => {
      void guestUploadTask.start(walletId, async (signal) => {
        await uploadGuestData(walletId, undefined, { signal });
        await guestStore.clear();
        // Anything cached under a guest local id is now stale: the same records
        // exist server-side under different ids.
        clearServerCache();
      });
    },
    [clearServerCache],
  );

  const signIn = useCallback(async (result: { user: UserResponse; tokens: AuthTokens }) => {
    await session.adopt(result.tokens);
    setUser(result.user);
    try {
      await localCache.rememberAccount({ userId: result.user.id, email: result.user.email });
      const others = await localCache.otherAccountsWithData(result.user.id, await offlineQueue.ownersWithOpenRows());
      if (others.length > 0) setOtherAccountNotice(others.map((account) => maskEmail(account.email)));
    } catch {
      // The notice is advisory; a local storage failure must not fail a login that succeeded.
    }
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => signIn(await authApi.login(credentials)),
    [signIn],
  );

  const register = useCallback(
    async (details: RegisterRequest) => signIn(await authApi.register(details)),
    [signIn],
  );

  const loginWithGoogle = useCallback(
    async (body: GoogleAuthRequest) => signIn(await authApi.google(body)),
    [signIn],
  );

  const dismissOtherAccountNotice = useCallback(() => setOtherAccountNotice(null), []);

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
    setOtherAccountNotice(null);
    // Another account's wallets must never be served from this cache. The saved
    // copy on disk stays; it is keyed to this account and read only by it.
    clearServerCache();
  }, [clearServerCache]);

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
      pendingGuestUpload: stored !== null && guestHasData && !uploadInBackground,
      guestUploadInBackground: stored !== null && guestHasData && uploadInBackground,
      startGuestUpload,
      otherAccountNotice,
      dismissOtherAccountNotice,
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
      uploadInBackground,
      startGuestUpload,
      otherAccountNotice,
      dismissOtherAccountNotice,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
