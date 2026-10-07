import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import NetInfo from '@react-native-community/netinfo';

import { healthApi } from '@/services/api';
import { setCurrentlyOnline } from '@/services/sync';

/** Whether the API answers, which a device with internet access can still fail to reach. */
export type ServerStatus = 'checking' | 'connected' | 'unreachable';

export interface NetworkStatusContextValue {
  isOnline: boolean;
  serverStatus: ServerStatus;
  checkServer: () => Promise<void>;
  isSyncing: boolean;
  retrySync: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
  isOnline: true,
  serverStatus: 'checking',
  checkServer: async () => {},
  isSyncing: false,
  retrySync: async () => {},
});

export interface NetworkStatusProviderProps {
  children: ReactNode;
  onRetrySync?: () => Promise<void>;
}

export function NetworkStatusProvider({ children, onRetrySync }: NetworkStatusProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const latestCheck = useRef(0);

  const checkServer = useCallback(async () => {
    // Only the newest probe may write: an older, slower one would otherwise overwrite a fresher answer.
    const check = ++latestCheck.current;
    setServerStatus('checking');
    const reachable = await healthApi.ping();
    if (check === latestCheck.current) setServerStatus(reachable ? 'connected' : 'unreachable');
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      setCurrentlyOnline(online);
      void checkServer();
    });
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void checkServer();
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [checkServer]);

  const retrySync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await onRetrySync?.();
    } finally {
      setIsSyncing(false);
    }
    void checkServer();
  }, [isSyncing, onRetrySync, checkServer]);

  return (
    <NetworkStatusContext.Provider value={{ isOnline, serverStatus, checkServer, isSyncing, retrySync }}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusContextValue {
  return useContext(NetworkStatusContext);
}
