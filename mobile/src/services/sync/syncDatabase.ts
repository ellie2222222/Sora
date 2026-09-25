/**
 * The app's one connection to the sync database, shared by the offline queue and the
 * read cache. Native only: web keeps both in memory.
 */

import { getRandomBytes } from 'expo-crypto';
import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { secureStore } from '@/services/storage';
import { openSyncDatabaseWith, type SyncDbDriver, type SyncDbHandle } from './syncDatabaseOpen.ts';

/** Keychain / Keystore, like the session tokens (MB-04): the key must not sit beside the file it opens. */
export const SYNC_DB_KEY_STORAGE_KEY = 'finance.syncDbKey.v1';

class ExpoSyncDbHandle implements SyncDbHandle {
  readonly db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  get path(): string {
    return this.db.databasePath;
  }

  exec(sql: string): Promise<void> {
    return this.db.execAsync(sql);
  }

  async scalar(sql: string): Promise<unknown> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(sql);
    return row ? (Object.values(row)[0] ?? null) : null;
  }

  close(): Promise<void> {
    return this.db.closeAsync();
  }
}

const expoDriver: SyncDbDriver<ExpoSyncDbHandle> = {
  // Stock SQLite ignores an unknown pragma, so only a SQLCipher build answers this.
  async cipherSupported() {
    const probe = await openDatabaseAsync(':memory:');
    try {
      return (await probe.getFirstAsync('PRAGMA cipher_version')) !== null;
    } finally {
      await probe.closeAsync();
    }
  },
  open: async (name) => new ExpoSyncDbHandle(await openDatabaseAsync(name)),
  remove: (name) => deleteDatabaseAsync(name),
  readKey: () => secureStore.get(SYNC_DB_KEY_STORAGE_KEY),
  writeKey: (key) => secureStore.set(SYNC_DB_KEY_STORAGE_KEY, key),
  newKey: () => Array.from(getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join(''),
};

let opening: Promise<SQLiteDatabase> | null = null;

export function syncDatabase(): Promise<SQLiteDatabase> {
  if (opening === null) {
    const attempt = openSyncDatabaseWith(expoDriver).then((handle) => handle.db);
    // A failed open is retried by the next caller instead of failing every later read and write.
    attempt.catch(() => {
      if (opening === attempt) opening = null;
    });
    opening = attempt;
  }
  return opening;
}
