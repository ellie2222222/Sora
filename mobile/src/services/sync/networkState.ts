/**
 * The last-known "can the API be reached" signal, readable from plain functions.
 *
 * RTK Query's `queryFn`/`onQueryStarted` cannot reach React context, so
 * `useNetworkStatus`'s `isOnline` (a `useState` value) isn't reachable from
 * an entity api slice deciding whether to enqueue offline. This is a single
 * module-level flag instead of a Redux slice on purpose — it is a fast
 * platform signal, set by NetInfo, by every signed-in read and write, by the
 * sync pass and by the reachability probe. Its listeners are how the app notices
 * the API is back when the device never lost internet (a server outage).
 */

export type OnlineListener = (online: boolean) => void;

let online = true;
const listeners = new Set<OnlineListener>();

export function isCurrentlyOnline(): boolean {
  return online;
}

export function setCurrentlyOnline(value: boolean): void {
  if (value === online) return;
  online = value;
  for (const listener of listeners) listener(value);
}

/** Called on every change, never on a repeat of the current value. */
export function onOnlineChange(listener: OnlineListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
