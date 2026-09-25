/**
 * SQLite storage for `LocalCache`, in the same sync database as the offline queue
 * (`syncDatabase.ts`, encrypted where the build allows). Web keeps the cache in memory.
 */

import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { memoryLocalCacheDb, type DeviceAccount, type LocalCacheDb } from './localCache.ts';
import { syncDatabase } from './syncDatabase.ts';

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS cached_responses (
    owner_user_id TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    json TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, cache_key)
  );
  CREATE INDEX IF NOT EXISTS idx_cached_responses_saved ON cached_responses(owner_user_id, saved_at);
  CREATE TABLE IF NOT EXISTS device_accounts (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
`;

class SqliteLocalCacheDb implements LocalCacheDb {
  private ready: Promise<SQLiteDatabase> | null = null;

  private open(): Promise<SQLiteDatabase> {
    if (this.ready === null) {
      const attempt = syncDatabase().then(async (db) => {
        await db.execAsync(CREATE_SQL);
        return db;
      });
      attempt.catch(() => {
        if (this.ready === attempt) this.ready = null;
      });
      this.ready = attempt;
    }
    return this.ready;
  }

  async put(ownerUserId: string, key: string, json: string, savedAt: string): Promise<void> {
    await (await this.open()).runAsync(
      `INSERT INTO cached_responses (owner_user_id, cache_key, json, saved_at) VALUES ($owner, $key, $json, $at)
       ON CONFLICT (owner_user_id, cache_key) DO UPDATE SET json = excluded.json, saved_at = excluded.saved_at`,
      { $owner: ownerUserId, $key: key, $json: json, $at: savedAt },
    );
  }

  async get(ownerUserId: string, key: string): Promise<{ json: string; savedAt: string } | null> {
    const row = await (await this.open()).getFirstAsync<{ json: string; saved_at: string }>(
      'SELECT json, saved_at FROM cached_responses WHERE owner_user_id = $owner AND cache_key = $key',
      { $owner: ownerUserId, $key: key },
    );
    return row ? { json: row.json, savedAt: row.saved_at } : null;
  }

  async prune(ownerUserId: string, keep: number): Promise<void> {
    await (await this.open()).runAsync(
      `DELETE FROM cached_responses WHERE owner_user_id = $owner AND cache_key NOT IN (
         SELECT cache_key FROM cached_responses WHERE owner_user_id = $owner ORDER BY saved_at DESC LIMIT $keep
       )`,
      { $owner: ownerUserId, $keep: keep },
    );
  }

  async rememberAccount(account: DeviceAccount, seenAt: string): Promise<void> {
    await (await this.open()).runAsync(
      `INSERT INTO device_accounts (user_id, email, last_seen_at) VALUES ($id, $email, $at)
       ON CONFLICT (user_id) DO UPDATE SET email = excluded.email, last_seen_at = excluded.last_seen_at`,
      { $id: account.userId, $email: account.email, $at: seenAt },
    );
  }

  async accounts(): Promise<DeviceAccount[]> {
    const rows = await (await this.open()).getAllAsync<{ user_id: string; email: string }>(
      'SELECT user_id, email FROM device_accounts ORDER BY last_seen_at DESC',
      {},
    );
    return rows.map((row) => ({ userId: row.user_id, email: row.email }));
  }

  async ownersWithCache(): Promise<string[]> {
    const rows = await (await this.open()).getAllAsync<{ owner_user_id: string }>(
      'SELECT DISTINCT owner_user_id FROM cached_responses',
      {},
    );
    return rows.map((row) => row.owner_user_id);
  }
}

export const localCacheDb: LocalCacheDb = Platform.OS === 'web' ? memoryLocalCacheDb() : new SqliteLocalCacheDb();
