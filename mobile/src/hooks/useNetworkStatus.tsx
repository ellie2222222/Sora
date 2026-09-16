import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

import NetInfo from '@react-native-community/netinfo';

import { setCurrentlyOnline } from '@/services/sync';

export interface NetworkStatusContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  retrySync: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
  isOnline: true,
  isSyncing: false,
  retrySync: async () => {},
});

export interface NetworkStatusProviderProps {
  children: ReactNode;
  onRetrySync?: () => Promise<void>;
}

export function NetworkStatusProvider({ children, onRetrySync }: NetworkStatusProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
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
      await onRetrySync?.();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onRetrySync]);

  return (
    <NetworkStatusContext.Provider value={{ isOnline, isSyncing, retrySync }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusContextValue {
  return useContext(NetworkStatusContext);
}
