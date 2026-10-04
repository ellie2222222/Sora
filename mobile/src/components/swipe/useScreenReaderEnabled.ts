import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let enabled = false;
const listeners = new Set<() => void>();
let subscribed = false;

/** One system subscription shared by every row, however many a list renders. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!subscribed) {
    subscribed = true;
    const update = (next: boolean) => {
      if (next === enabled) return;
      enabled = next;
      listeners.forEach((notify) => notify());
    };
    void AccessibilityInfo.isScreenReaderEnabled().then(update, () => undefined);
    AccessibilityInfo.addEventListener('screenReaderChanged', update);
  }
  return () => listeners.delete(listener);
}

export function useScreenReaderEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled, () => false);
}
