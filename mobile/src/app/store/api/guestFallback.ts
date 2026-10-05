import { ensureSeeded } from '@/services/guest';
import { localCache, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '@/utils';
import { readSignedIn } from './signedInRead.ts';

/**
 * The read path every query shares: a guest reads the guest store; a signed-in user
 * reads the API, answering from their own saved copy under `cacheKey` when offline.
 */
export async function readGuestOrApi<T>(
  cacheKey: string,
  isGuest: boolean,
  fromApi: () => Promise<T>,
  fromLocal: () => Promise<T>,
): Promise<T> {
  if (isGuest) {
    await ensureSeeded();
    return fromLocal();
  }
  return readSignedInCached(cacheKey, fromApi);
}

/** A signed-in-only read: the API, or the account's own saved copy under `cacheKey` when offline. */
export function readSignedInCached<T>(cacheKey: string, fromApi: () => Promise<T>): Promise<T> {
  return readSignedIn(fromApi, setCurrentlyOnline, isNetworkError, localCache.entry<T>(cacheKey));
}
