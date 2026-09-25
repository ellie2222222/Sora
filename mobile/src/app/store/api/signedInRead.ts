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
 * No short-circuit while flagged offline: the flag is only cleared by the next
 * NetInfo change, so one failed request would otherwise block every read after it.
 */
export async function readSignedIn<T>(
  fromApi: () => Promise<T>,
  setOnline: (online: boolean) => void,
  isNetworkError: (error: unknown) => boolean,
  cache?: ReadCache<T>,
): Promise<T> {
  let result: T;
  try {
    result = await fromApi();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    setOnline(false);
    const saved = await cache?.load();
    if (saved !== undefined) return saved;
    throw error;
  }
  setOnline(true);
  // A failed write must not turn a good read into an error.
  await cache?.save(result).catch(() => undefined);
  return result;
}
