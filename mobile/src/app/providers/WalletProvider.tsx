import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { WalletResponse } from '@sora/contracts';

import { queryKeys } from '../config/queryKeys.ts';
import { walletsApi } from '../../services/api/wallets.ts';
import { permissionsFor, type WalletPermissions } from '../../utils/roles.ts';
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
  permissions: WalletPermissions;
  setActiveWalletId: (walletId: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }): ReactNode {
  const { isAuthenticated } = useAuth();
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.wallets.list(),
    queryFn: () => walletsApi.list({ status: 'ACTIVE' }),
    enabled: isAuthenticated,
  });

  const wallets = query.data ?? [];

  useEffect(() => {
    if (activeWalletId !== null && wallets.some((w) => w.id === activeWalletId)) return;
    // The most useful default on first load or after the active wallet is
    // archived/left: the caller's own wallet, ahead of any shared one, since
    // it's the one every new account has and the one most sessions start from.
    const own = wallets.find((w) => w.isOwn);
    const fallback = own ?? wallets[0] ?? null;
    if (fallback !== null) setActiveWalletId(fallback.id);
  }, [wallets, activeWalletId]);

  const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;
  const permissions = useMemo(() => permissionsFor(activeWallet?.role ?? null), [activeWallet]);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallets,
      activeWallet,
      activeWalletId: activeWallet?.id ?? null,
      permissions,
      setActiveWalletId,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => void query.refetch(),
    }),
    [wallets, activeWallet, permissions, query.isLoading, query.isError, query.refetch],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallets(): WalletContextValue {
  const context = useContext(WalletContext);
  if (context === null) throw new Error('useWallets must be used inside WalletProvider');
  return context;
}
