import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import NetInfo from '@react-native-community/netinfo';

import { healthApi } from '@/services/api';
import { onOnlineChange, setCurrentlyOnline } from '@/services/sync';
import { setDeviceOnline } from '@/utils';

/** Whether the API answers, which a device with internet access can still fail to reach. */
export type ServerStatus = 'checking' | 'connected' | 'unreachable';

export interface NetworkStatusContextValue {
  isOnline: boolean;
  serverStatus: ServerStatus;
  checkServer: () => Promise<void>;
  isSyncing: boolean;
  retrySync: () => Promise<void>;
  /** Try one stuck queued write again, or drop it and what depends on it (`syncEngineRuntime.ts`). */
  retryQueued: (queueId: string) => Promise<void>;
  discardQueued: (queueId: string) => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
  isOnline: true,
  serverStatus: 'checking',
  checkServer: async () => {},
  isSyncing: false,
  retrySync: async () => {},
  retryQueued: async () => {},
  discardQueued: async () => {},
});

export interface NetworkStatusProviderProps {
  children: ReactNode;
  onRetrySync?: () => Promise<void>;
  onRetryQueued?: (queueId: string) => Promise<void>;
  onDiscardQueued?: (queueId: string) => Promise<void>;
}

export function NetworkStatusProvider({ children, onRetrySync, onRetryQueued, onDiscardQueued }: NetworkStatusProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const latestCheck = useRef(0);

  const checkServer = useCallback(async () => {
    // Only the newest probe may write: an older, slower one would otherwise overwrite a fresher answer.
    const check = ++latestCheck.current;
    setServerStatus('checking');
    const reachable = await healthApi.ping();
    if (check !== latestCheck.current) return;
    setServerStatus(reachable ? 'connected' : 'unreachable');
    // An answer from the API itself, so it may raise the flag as well as lower it.
    setCurrentlyOnline(reachable);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      setDeviceOnline(online);
      // Only ever lowers it: internet back says nothing about the API, which checkServer then asks.
      if (!online) setCurrentlyOnline(false);
      void checkServer();
    });
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void checkServer();
    });
    // A read, write, sync pass or probe finding the API gone (or back) mid-session, which NetInfo never reports.
    const unsubscribeOnline = onOnlineChange((online) => setServerStatus(online ? 'connected' : 'unreachable'));

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      unsubscribeOnline();
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
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        serverStatus,
        checkServer,
        isSyncing,
        retrySync,
        retryQueued: async (queueId) => onRetryQueued?.(queueId),
        discardQueued: async (queueId) => onDiscardQueued?.(queueId),
      }}
    >
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusContextValue {
  return useContext(NetworkStatusContext);
}
