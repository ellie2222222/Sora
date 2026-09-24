import { ensureSeeded } from '@/services/guest';
import { isCurrentlyOnline, setCurrentlyOnline } from '@/services/sync';
import { isNetworkError } from '@/utils';

/**
 * The read path every query shares: a guest, or a device already known to be offline, reads the local
 * store; otherwise the API, falling back to the local store (and recording "offline") only when the
 * request got no response at all — a server error still surfaces as an error.
 */
export async function readWithGuestFallback<T>(
  isGuest: boolean,
  fromApi: () => Promise<T>,
  fromLocal: () => Promise<T>,
): Promise<T> {
  if (isGuest || !isCurrentlyOnline()) {
    await ensureSeeded();
    return fromLocal();
  }
  try {
    return await fromApi();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    setCurrentlyOnline(false);
    await ensureSeeded();
    return fromLocal();
  }
}
