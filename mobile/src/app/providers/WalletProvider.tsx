import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { WalletResponse } from '@sora/contracts';

import { useListWalletsQuery } from '@/app/store';
import { deviceTimeZone, permissionsFor, type WalletPermissions, isNetworkError } from '@/utils';
import { useAuth } from './AuthProvider.tsx';

/**
 * Which wallet the rest of the app is looking at.
 *
 * A dedicated provider rather than a route param: transactions, budgets, goals
 * and the dashboard all need "the active wallet" simultaneously, and every one
 * of those screens is reachable from the tab bar, not only by drilling in from
 * a wallet detail screen.
 */
interface WalletContextValue {
  wallets: WalletResponse[];
  activeWallet: WalletResponse | null;
  activeWalletId: string | null;
  /** The active wallet's zone, which its days, months and "today" are read in; this device's until one loads. */
  timeZone: string;
  permissions: WalletPermissions;
  setActiveWalletId: (walletId: string) => void;
  /** The wallet a switch is opening, until the switch's loading screen has seen its data arrive. */
  switchingTo: WalletResponse | null;
  /** Ends the switch to `walletId`; a later switch already under way is left running. */
  finishSwitch: (walletId: string) => void;
  isLoading: boolean;
  isError: boolean;
  /** The list couldn't be reached and nothing is saved: the user's wallets are unknown, not absent. */
  isUnavailable: boolean;
  refetch: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }): ReactNode {
  const { isAuthenticated, isGuest } = useAuth();
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  const query = useListWalletsQuery(
    { status: 'ACTIVE' },
    { skip: !(isAuthenticated || isGuest) },
  );

  const wallets = query.data ?? [];

  const effectiveWalletId = useMemo(() => {
    if (activeWalletId !== null && wallets.some((w) => w.id === activeWalletId)) return activeWalletId;
    const own = wallets.find((w) => w.isOwn);
    return own?.id ?? wallets[0]?.id ?? null;
  }, [wallets, activeWalletId]);

  const [switchingToId, setSwitchingToId] = useState<string | null>(null);

  useEffect(() => {
    if (activeWalletId !== effectiveWalletId) {
      setActiveWalletId(effectiveWalletId);
    }
    // A wallet that could not become active (not in the list) is not being opened.
    if (switchingToId !== null && switchingToId !== effectiveWalletId) setSwitchingToId(null);
  }, [activeWalletId, effectiveWalletId, switchingToId]);

  const effectiveWalletIdRef = useRef(effectiveWalletId);
  effectiveWalletIdRef.current = effectiveWalletId;
  const selectWallet = useCallback((walletId: string) => {
    if (walletId !== effectiveWalletIdRef.current) setSwitchingToId(walletId);
    setActiveWalletId(walletId);
  }, []);
  const finishSwitch = useCallback((walletId: string) => setSwitchingToId((current) => (current === walletId ? null : current)), []);
  const switchingTo = wallets.find((w) => w.id === switchingToId) ?? null;

  const activeWallet = wallets.find((w) => w.id === effectiveWalletId) ?? null;
  const permissions = useMemo(() => permissionsFor(activeWallet?.role ?? null), [activeWallet]);
  // A wallet cached by a version without zones has none; reading it in this device's zone is the safe default.
  const timeZone = activeWallet?.timeZone ?? deviceTimeZone();

  const value = useMemo<WalletContextValue>(
    () => ({
      wallets,
      activeWallet,
      activeWalletId: effectiveWalletId,
      timeZone,
      permissions,
      setActiveWalletId: selectWallet,
      switchingTo,
      finishSwitch,
      isLoading: query.isLoading || (query.isFetching && query.data === undefined),
      isError: query.isError && !isNetworkError(query.error),
      isUnavailable: query.isError && isNetworkError(query.error) && query.data === undefined,
      refetch: () => void query.refetch(),
    }),
    [
      wallets,
      activeWallet,
      effectiveWalletId,
      timeZone,
      permissions,
      selectWallet,
      switchingTo,
      finishSwitch,
      query.isLoading,
      query.isFetching,
      query.isError,
      query.error,
      query.data,
      query.refetch,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallets(): WalletContextValue {
  const context = useContext(WalletContext);
  if (context === null) throw new Error('useWallets must be used inside WalletProvider');
  return context;
}
