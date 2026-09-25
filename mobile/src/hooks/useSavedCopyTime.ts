import { useSyncExternalStore } from 'react';

import { localCache } from '@/services/sync';

const subscribe = (listener: () => void) => localCache.subscribe(listener);
const snapshot = () => localCache.oldestShownSavedAt();

/** When the oldest saved copy on screen was saved, or null while every read is fresh. */
export function useSavedCopyTime(): string | null {
  return useSyncExternalStore(subscribe, snapshot);
}
