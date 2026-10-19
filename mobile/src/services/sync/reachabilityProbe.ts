/**
 * While the API is flagged unreachable, asks it whether it is back, with a growing delay so an outage is
 * not met with a request every few seconds. Nothing else re-checks when the device keeps its internet
 * through a server outage: NetInfo never changes, so without this the app would stay on saved copies.
 *
 * Platform-free (timers and the ping are injected), so it runs under bare `node --test`.
 */

export const PROBE_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000] as const;
/**
 * The API counts as back only once it has stayed reachable this long. A fall sooner (one endpoint that keeps
 * timing out while /health answers) keeps the backoff growing, or every rise would refetch every screen again.
 */
export const STABLE_MS = 2 * 60_000;

export interface ReachabilityProbeDeps {
  ping(): Promise<boolean>;
  isOnline(): boolean;
  setOnline(online: boolean): void;
  onOnlineChange(listener: (online: boolean) => void): () => void;
  /** No point asking the API while the device itself has no internet; NetInfo reports its return. */
  canReachInternet(): boolean;
  setTimer?(run: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
  now?(): number;
}

export function delayForAttempt(attempt: number): number {
  return PROBE_DELAYS_MS[Math.min(attempt, PROBE_DELAYS_MS.length - 1)]!;
}

export function startReachabilityProbe(deps: ReachabilityProbeDeps): () => void {
  const setTimer = deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const now = deps.now ?? Date.now;
  let timer: unknown = null;
  let attempt = 0;
  let upSince: number | null = null;
  let stopped = false;

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = () => {
    cancel();
    if (stopped || deps.isOnline()) return;
    timer = setTimer(() => {
      timer = null;
      void probe();
    }, delayForAttempt(attempt));
  };

  const probe = async () => {
    if (stopped || deps.isOnline()) return;
    const reachable = deps.canReachInternet() && (await deps.ping());
    if (stopped || deps.isOnline()) return;
    if (reachable) {
      deps.setOnline(true);
      return;
    }
    attempt += 1;
    schedule();
  };

  const unsubscribe = deps.onOnlineChange((online) => {
    if (online) {
      upSince = now();
      cancel();
      return;
    }
    const shortLived = upSince !== null && now() - upSince < STABLE_MS;
    attempt = shortLived ? attempt + 1 : 0;
    upSince = null;
    schedule();
  });
  schedule();

  return () => {
    stopped = true;
    cancel();
    unsubscribe();
  };
}
