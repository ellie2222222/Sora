/**
 * The last-known online/offline signal, readable from plain functions.
 *
 * RTK Query's `queryFn`/`onQueryStarted` cannot reach React context, so
 * `useNetworkStatus`'s `isOnline` (a `useState` value) isn't reachable from
 * an entity api slice deciding whether to enqueue offline. This is a single
 * module-level flag instead of a Redux slice on purpose — it is a fast
 * platform signal nothing else needs to subscribe to reactively at the store
 * level, and `NetInfo` already gives a synchronous last-known value; this is
 * just that value, set by the one listener `useNetworkStatus.tsx` owns.
 */

let online = true;

export function isCurrentlyOnline(): boolean {
  return online;
}

export function setCurrentlyOnline(value: boolean): void {
  online = value;
}
