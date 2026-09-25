/**
 * The RN-touching half of the sync engine: wires real triggers (reconnect,
 * foreground, a foreground safety-net interval) to `runSyncPass`, and
 * reconciles the RTK Query cache once a pass completes. Only this file
 * imports AppState/NetInfo/the api slices — `syncEngine.ts`'s `runSyncPass`
 * stays platform-free and unit-testable.
 */

import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { API_TAG_TYPES, apiSlice } from '../../app/store/api/apiSlice.ts';
import { queueRowsReplaced } from '../../app/store/offlineQueueSlice.ts';
import type { AppStore } from '@/app/store';
import { defaultEntityAdapters } from './entityAdapters.ts';
import { localCache } from './localCacheInstance.ts';
import { offlineQueue } from './offlineQueueInstance.ts';
import { runSyncPass } from './syncEngine.ts';
import type { QueueEntity } from './offlineQueueTypes.ts';

// The same sets the online mutations invalidate: a synced write replaces every figure its offline patch moved.
const ENTITY_TAGS: Record<QueueEntity, Parameters<typeof apiSlice.util.invalidateTags>[0]> = {
  transaction: ['Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet', 'Goal'],
  account: ['Account', 'Wallet', 'Dashboard'],
  budget: ['Budget', 'Dashboard'],
  goal: ['Goal'],
  category: ['Category', 'Budget', 'Dashboard', 'Transaction'],
  // A contribution moves goal progress, and one recorded as a transaction moves balances too.
  contribution: ['Goal', 'GoalContribution', 'Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet'],
};

const FOREGROUND_INTERVAL_MS = 45_000;

/**
 * Boots the queue (subscribe + hydrate from SQLite) and wires every sync
 * trigger. Returns a teardown for symmetry, though the app never tears this
 * down in practice — it lives for the process lifetime, same as the store.
 */
export function startSyncEngine(store: AppStore): () => void {
  const unsubscribeQueue = offlineQueue.subscribe((rows) => {
    store.dispatch(queueRowsReplaced(rows));
  });

  void offlineQueue.refresh();

  let running = false;
  let refreshAfterPass = false;
  const trigger = () => {
    if (running) return;
    running = true;
    void defaultEntityAdapters()
      .then((adapters) =>
        runSyncPass(offlineQueue, adapters, {
          onSynced: (row) => store.dispatch(apiSlice.util.invalidateTags(ENTITY_TAGS[row.entity])),
        }),
      )
      .finally(() => {
        running = false;
        if (refreshAfterPass) {
          refreshAfterPass = false;
          refreshEverything(store);
        }
      });
  };

  let wasOnline = true;
  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    // After the queue drains, not before: a refetch ahead of the sync would drop the offline patches for a moment.
    if (online && !wasOnline) refreshAfterPass = true;
    wasOnline = online;
    if (online) trigger();
  });

  const handleAppStateChange = (status: AppStateStatus) => {
    if (status === 'active') trigger();
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  const interval = setInterval(() => {
    if (AppState.currentState === 'active') trigger();
  }, FOREGROUND_INTERVAL_MS);

  trigger();

  return () => {
    unsubscribeQueue();
    unsubscribeNetInfo();
    appStateSubscription.remove();
    clearInterval(interval);
  };
}

/** Back online: every screen still showing a saved copy reads the server again. */
function refreshEverything(store: AppStore): void {
  localCache.clearShownSavedCopies();
  store.dispatch(apiSlice.util.invalidateTags([...API_TAG_TYPES]));
}

/** For pull-to-refresh and the banner's "Try again" — a manual, on-demand pass. */
export async function requestSyncNow(store: AppStore): Promise<void> {
  const adapters = await defaultEntityAdapters();
  await runSyncPass(offlineQueue, adapters, {
    onSynced: (row) => store.dispatch(apiSlice.util.invalidateTags(ENTITY_TAGS[row.entity])),
    ignoreBackoff: true,
  });
}
