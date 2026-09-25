/**
 * The signed-in read cache: every successful API read is saved per account, and
 * a read that finds no network answers from it (SDS §4.4). The server stays the
 * source of truth — this only replays what it last said. Scoped to one account
 * at a time (CLAUDE.md rule 17); other accounts' rows stay on the device, unread.
 *
 * Platform-free so it runs under bare `node --test`; SQLite is in `localCacheDb.ts`.
 */

export interface DeviceAccount {
  userId: string;
  email: string;
}

export interface LocalCacheDb {
  put(ownerUserId: string, key: string, json: string, savedAt: string): Promise<void>;
  get(ownerUserId: string, key: string): Promise<{ json: string; savedAt: string } | null>;
  /** Drops the owner's least recently saved rows beyond `keep`. */
  prune(ownerUserId: string, keep: number): Promise<void>;
  rememberAccount(account: DeviceAccount, seenAt: string): Promise<void>;
  accounts(): Promise<DeviceAccount[]>;
  ownersWithCache(): Promise<string[]>;
}

/** Enough for every screen a user realistically visits; the oldest responses go first. */
export const MAX_CACHED_RESPONSES = 1000;

function stableStringify(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** One key per endpoint + argument (+ page), matching however RTK Query was called. */
export function cacheKeyOf(endpoint: string, arg: unknown, page?: number): string {
  return page === undefined ? `${endpoint}|${stableStringify(arg)}` : `${endpoint}|${stableStringify(arg)}|p${page}`;
}

/** `alice@example.invalid` → `a•••@example.invalid`: enough to recognise an account, not to read it. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}

export class LocalCache {
  private owner: string | null = null;
  private readonly db: LocalCacheDb;
  private readonly now: () => string;

  constructor(db: LocalCacheDb, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** Per read key, when the saved copy being shown in place of a fresh response was saved. */
  private readonly shownSaved = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  setOwner(userId: string | null): void {
    this.owner = userId;
    this.clearShownSavedCopies();
  }

  /** The oldest saved copy still on screen, for the "saved at" note; null when all is fresh. */
  oldestShownSavedAt(): string | null {
    let oldest: string | null = null;
    for (const savedAt of this.shownSaved.values()) if (oldest === null || savedAt < oldest) oldest = savedAt;
    return oldest;
  }

  clearShownSavedCopies(): void {
    if (this.shownSaved.size === 0) return;
    this.shownSaved.clear();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  save(key: string, value: unknown): Promise<void> {
    return this.saveFor(this.owner, key, value);
  }

  load<T>(key: string): Promise<T | undefined> {
    return this.loadFor<T>(this.owner, key);
  }

  /**
   * One read's saved copy, bound to the account current when the read started, so a
   * response still in flight across an account switch is never saved under the next one.
   */
  entry<T>(key: string): { load(): Promise<T | undefined>; save(value: T): Promise<void> } {
    const owner = this.owner;
    return {
      load: async () => {
        const row = await this.rowFor(owner, key);
        if (row === null) return undefined;
        if (owner === this.owner && this.shownSaved.get(key) !== row.savedAt) {
          this.shownSaved.set(key, row.savedAt);
          this.emit();
        }
        return JSON.parse(row.json) as T;
      },
      save: async (value) => {
        await this.saveFor(owner, key, value);
        if (owner === this.owner && this.shownSaved.delete(key)) this.emit();
      },
    };
  }

  private async saveFor(owner: string | null, key: string, value: unknown): Promise<void> {
    if (owner === null) return;
    await this.db.put(owner, key, JSON.stringify(value), this.now());
    await this.db.prune(owner, MAX_CACHED_RESPONSES);
  }

  private async loadFor<T>(owner: string | null, key: string): Promise<T | undefined> {
    const row = await this.rowFor(owner, key);
    return row ? (JSON.parse(row.json) as T) : undefined;
  }

  private rowFor(owner: string | null, key: string): Promise<{ json: string; savedAt: string } | null> {
    return owner === null ? Promise.resolve(null) : this.db.get(owner, key);
  }

  rememberAccount(account: DeviceAccount): Promise<void> {
    return this.db.rememberAccount(account, this.now());
  }

  /** Accounts other than `userId` that still have data here — cached reads or unsynced writes. */
  async otherAccountsWithData(userId: string, queuedOwners: readonly string[]): Promise<DeviceAccount[]> {
    const withData = new Set([...(await this.db.ownersWithCache()), ...queuedOwners]);
    withData.delete(userId);
    return (await this.db.accounts()).filter((account) => withData.has(account.userId));
  }
}

/** Map-backed store for web (no persistence) and tests. */
export function memoryLocalCacheDb(): LocalCacheDb {
  const rows = new Map<string, { owner: string; json: string; savedAt: string }>();
  const accounts = new Map<string, DeviceAccount & { seenAt: string }>();
  const id = (owner: string, key: string) => `${owner}\u0000${key}`;

  return {
    async put(owner, key, json, savedAt) {
      rows.set(id(owner, key), { owner, json, savedAt });
    },
    async get(owner, key) {
      const row = rows.get(id(owner, key));
      return row ? { json: row.json, savedAt: row.savedAt } : null;
    },
    async prune(owner, keep) {
      const own = [...rows.entries()]
        .filter(([, row]) => row.owner === owner)
        .sort(([, a], [, b]) => b.savedAt.localeCompare(a.savedAt));
      for (const [rowId] of own.slice(keep)) rows.delete(rowId);
    },
    async rememberAccount(account, seenAt) {
      accounts.set(account.userId, { ...account, seenAt });
    },
    async accounts() {
      return [...accounts.values()]
        .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
        .map(({ userId, email }) => ({ userId, email }));
    },
    async ownersWithCache() {
      return [...new Set([...rows.values()].map((row) => row.owner))];
    },
  };
}

interface CacheEntryLike {
  endpointName?: string;
  originalArgs?: unknown;
  data?: unknown;
}

/**
 * What to save for one RTK Query cache entry, under the same keys the reads use:
 * one row per loaded page for an infinite query, one row otherwise.
 */
export function savesForCacheEntry(entry: CacheEntryLike | undefined): { key: string; value: unknown }[] {
  if (!entry?.endpointName || entry.data === undefined) return [];
  const data = entry.data as { pages?: unknown[]; pageParams?: unknown[] };
  if (Array.isArray(data.pages) && Array.isArray(data.pageParams)) {
    return data.pages.map((page, index) => ({
      key: cacheKeyOf(entry.endpointName as string, entry.originalArgs, data.pageParams?.[index] as number),
      value: page,
    }));
  }
  return [{ key: cacheKeyOf(entry.endpointName, entry.originalArgs), value: entry.data }];
}
