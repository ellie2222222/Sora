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
import { dependentRows, prunableRows, runSyncPass } from './syncEngine.ts';
import type { QueuedMutation } from './offlineQueueTypes.ts';
import { DeferredInvalidation, ENTITY_TAGS } from './syncTags.ts';

type ApiTag = (typeof API_TAG_TYPES)[number];

const FOREGROUND_INTERVAL_MS = 45_000;

const invalidation = new DeferredInvalidation();

/** Refreshes `tags` now where no open queue row holds them, and the rest once none does (`syncTags.ts`). */
function refreshTags(store: AppStore, tags: Iterable<string>): void {
  const ready = invalidation.release(tags, offlineQueue.current());
  if (ready.length > 0) store.dispatch(apiSlice.util.invalidateTags(ready as ApiTag[]));
}

function tagsOf(rows: readonly QueuedMutation[]): string[] {
  return rows.flatMap((row) => ENTITY_TAGS[row.entity]);
}

async function syncPass(store: AppStore, ignoreBackoff = false): Promise<void> {
  const synced: QueuedMutation[] = [];
  const adapters = await defaultEntityAdapters();
  await runSyncPass(offlineQueue, adapters, { onSynced: (row) => synced.push(row), ignoreBackoff });
  // After the pass, when the queue says which writes are still open, never row by row in between.
  refreshTags(store, tagsOf(synced));
  // Without this the table only grows, and every status change re-reads all of it.
  const stale = prunableRows(offlineQueue.current(), Date.now());
  if (stale.length > 0) await offlineQueue.discard(stale.map((row) => row.queueId));
}

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
  let focusAfterPass = false;
  const trigger = () => {
    if (running) return;
    running = true;
    void syncPass(store).finally(() => {
      running = false;
      if (refreshAfterPass) {
        refreshAfterPass = false;
        focusAfterPass = false;
        // Back online: every screen still showing a saved copy reads the server again.
        localCache.clearShownSavedCopies();
        refreshTags(store, API_TAG_TYPES);
      } else if (focusAfterPass) {
        focusAfterPass = false;
        // RTK's own focus refetch needs `window` events React Native doesn't have: this is what picks up
        // another member's changes made while the app was in the background.
        refreshTags(store, API_TAG_TYPES);
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

  let lastAppState = AppState.currentState;
  const handleAppStateChange = (status: AppStateStatus) => {
    if (status === 'active' && lastAppState !== 'active') focusAfterPass = true;
    lastAppState = status;
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

/** A manual, on-demand pass, for the sync status's "Sync now". */
export function requestSyncNow(store: AppStore): Promise<void> {
  return syncPass(store, true);
}

/** "Try again" on one stuck change: back to the start of its retries, then a pass right away. */
export async function retryQueuedWrite(store: AppStore, queueId: string): Promise<void> {
  await offlineQueue.retry(queueId);
  await syncPass(store, true);
}

/**
 * "Discard" on one stuck change: it and everything waiting on it leave the device unsent, and the
 * reads its offline patch moved are refreshed, so the screens show only what the server holds.
 */
export async function discardQueuedWrite(store: AppStore, queueId: string): Promise<void> {
  const target = offlineQueue.current().find((row) => row.queueId === queueId);
  if (!target) return;
  const discarded = dependentRows(offlineQueue.current(), target);
  await offlineQueue.discard(discarded.map((row) => row.queueId));
  refreshTags(store, tagsOf(discarded));
}
