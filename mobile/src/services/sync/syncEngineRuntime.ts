/**
 * The RN-touching half of the sync engine: wires real triggers (reconnect,
 * foreground, a foreground safety-net interval) to `runSyncPass`, and
 * reconciles the RTK Query cache once a pass completes. Only this file
 * imports AppState/NetInfo/the api slices — `syncEngine.ts`'s `runSyncPass`
 * stays platform-free and unit-testable.
 */

import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { apiSlice } from '../../app/store/api/apiSlice.ts';
import type { AppStore } from '../../app/store/index.ts';
import { queueRowsReplaced } from '../../app/store/offlineQueueSlice.ts';
import { defaultEntityAdapters } from './entityAdapters.ts';
import { offlineQueue } from './offlineQueueInstance.ts';
import { runSyncPass } from './syncEngine.ts';
import type { QueueEntity } from './offlineQueueTypes.ts';

const ENTITY_TAGS: Record<QueueEntity, Parameters<typeof apiSlice.util.invalidateTags>[0][number]> = {
  transaction: 'Transaction',
  account: 'Account',
  budget: 'Budget',
  goal: 'Goal',
  category: 'Category',
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
  const trigger = () => {
    if (running) return;
    running = true;
    void defaultEntityAdapters()
      .then((adapters) =>
        runSyncPass(offlineQueue, adapters, (row) => {
          store.dispatch(apiSlice.util.invalidateTags([ENTITY_TAGS[row.entity]]));
        }),
      )
      .finally(() => {
        running = false;
      });
  };

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected === true && state.isInternetReachable !== false) trigger();
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

/** For pull-to-refresh and the banner's "Try again" — a manual, on-demand pass. */
export async function requestSyncNow(store: AppStore): Promise<void> {
  const adapters = await defaultEntityAdapters();
  await runSyncPass(offlineQueue, adapters, (row) => {
    store.dispatch(apiSlice.util.invalidateTags([ENTITY_TAGS[row.entity]]));
  });
}
