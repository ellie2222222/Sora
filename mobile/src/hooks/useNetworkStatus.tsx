import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

import NetInfo from '@react-native-community/netinfo';

import { setCurrentlyOnline } from '../services/sync/networkState.ts';

export interface NetworkStatusContextValue {
  isOnline: boolean;
  hasSyncError: boolean;
  isSyncing: boolean;
  setSyncError: (hasError: boolean) => void;
  retrySync: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
  isOnline: true,
  hasSyncError: false,
  isSyncing: false,
  setSyncError: () => {},
  retrySync: async () => {},
});

export interface NetworkStatusProviderProps {
  children: ReactNode;
  onRetrySync?: () => Promise<void>;
}

export function NetworkStatusProvider({ children, onRetrySync }: NetworkStatusProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [hasSyncError, setHasSyncError] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      setCurrentlyOnline(online);
    });

    return unsubscribe;
  }, []);

  const retrySync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (onRetrySync) {
        await onRetrySync();
      }
      setHasSyncError(false);
    } catch {
      setHasSyncError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onRetrySync]);

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        hasSyncError,
        isSyncing,
        setSyncError: setHasSyncError,
        retrySync,
      }}
    >
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusContextValue {
  return useContext(NetworkStatusContext);
}
