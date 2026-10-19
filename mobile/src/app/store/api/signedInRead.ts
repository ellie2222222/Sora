/** Where a signed-in read's last good response is kept for the next time the network is gone. */
export interface ReadCache<T> {
  load(): Promise<T | undefined>;
  save(value: T): Promise<void>;
}

/**
 * A signed-in read: the API first, and on a network failure the account's own
 * saved copy of the last response. Never the guest store — that is a different
 * ledger, and seeding it routes the user to guest upload (CLAUDE.md rule 17).
 * With no saved copy the network error rethrows; screens treat it as non-fatal.
 *
 * A server fault (`isServerFault`) is answered from the saved copy too, but leaves
 * the online flag alone: one failing endpoint must not switch every write to the queue.
 * A refusal (4xx) always rethrows — a revoked member must not keep reading the wallet.
 *
 * No short-circuit while flagged offline: a read that succeeds is one of the ways the
 * app learns the API is back, so one failed request must not block every read after it.
 */
export async function readSignedIn<T>(
  fromApi: () => Promise<T>,
  setOnline: (online: boolean) => void,
  isNetworkError: (error: unknown) => boolean,
  cache?: ReadCache<T>,
  isServerFault: (error: unknown) => boolean = () => false,
): Promise<T> {
  let result: T;
  try {
    result = await fromApi();
  } catch (error) {
    const unreachable = isNetworkError(error);
    if (!unreachable && !isServerFault(error)) throw error;
    if (unreachable) setOnline(false);
    const saved = await cache?.load();
    if (saved !== undefined) return saved;
    throw error;
  }
  setOnline(true);
  // In the background: the copy only serves a later offline read, so the screen never waits on the disk,
  // and a failed write never turns a good read into an error.
  void cache?.save(result).catch(() => undefined);
  return result;
}
