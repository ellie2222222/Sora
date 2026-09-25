/**
 * How the sync database (offline queue + read cache) is opened: encrypted with SQLCipher
 * where the build includes it, plain where it doesn't (Expo Go ships stock SQLite).
 * An install that already has a plain file is copied into the encrypted one, then the
 * plain file is removed, so unsynced writes survive the switch.
 *
 * Platform-free so it runs under bare `node --test`; `syncDatabase.ts` supplies expo-sqlite.
 */

export const PLAIN_SYNC_DB = 'sora_sync.db';
export const ENCRYPTED_SYNC_DB = 'sora_sync_encrypted.db';

const KEY_PATTERN = /^[0-9a-f]{64}$/;

export interface SyncDbHandle {
  readonly path: string;
  exec(sql: string): Promise<void>;
  /** First column of the first row, or null when there is no row. */
  scalar(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export interface SyncDbDriver<H extends SyncDbHandle> {
  cipherSupported(): Promise<boolean>;
  /** Creates the file when it doesn't exist. */
  open(name: string): Promise<H>;
  /** Throws when the file is missing or can't be deleted. */
  remove(name: string): Promise<void>;
  readKey(): Promise<string | null>;
  writeKey(key: string): Promise<void>;
  /** 32 random bytes as 64 lowercase hex characters. */
  newKey(): string;
}

function keyPragma(key: string): string {
  return `PRAGMA key = "x'${key}'"`;
}

function siblingPath(path: string, name: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return `${path.slice(0, slash + 1)}${name}`;
}

async function hasTables(db: SyncDbHandle): Promise<boolean> {
  return Number(await db.scalar('SELECT count(*) FROM sqlite_master')) > 0;
}

/**
 * A plain file with data is the only copy until the export completes, so it is removed last.
 * One-way: a cipher build never writes the plain file, which is what makes a leftover encrypted file disposable.
 */
async function migratePlainFile<H extends SyncDbHandle>(driver: SyncDbDriver<H>, key: string): Promise<void> {
  const plain = await driver.open(PLAIN_SYNC_DB);
  try {
    if (await hasTables(plain)) {
      // Anything already at the encrypted path is a copy an earlier launch didn't finish. Opened
      // first so it exists: `remove` must fail loudly, or a plain file that survived would redo this.
      await (await driver.open(ENCRYPTED_SYNC_DB)).close();
      await driver.remove(ENCRYPTED_SYNC_DB);
      const target = siblingPath(plain.path, ENCRYPTED_SYNC_DB).replace(/'/g, "''");
      await plain.exec(`ATTACH DATABASE '${target}' AS encrypted KEY "x'${key}'"`);
      await plain.exec("SELECT sqlcipher_export('encrypted')");
      await plain.exec('DETACH DATABASE encrypted');
    }
  } finally {
    await plain.close();
  }
  await driver.remove(PLAIN_SYNC_DB);
}

export async function openSyncDatabaseWith<H extends SyncDbHandle>(driver: SyncDbDriver<H>): Promise<H> {
  if (!(await driver.cipherSupported())) return driver.open(PLAIN_SYNC_DB);

  const storedKey = await driver.readKey();
  const key = storedKey ?? driver.newKey();
  // Validated before any SQL: the key is interpolated, as PRAGMA and ATTACH take no bound parameters.
  if (!KEY_PATTERN.test(key)) throw new Error('Sync database key is malformed');
  if (storedKey === null) await driver.writeKey(key);

  await migratePlainFile(driver, key);

  const db = await driver.open(ENCRYPTED_SYNC_DB);
  await db.exec(keyPragma(key));
  try {
    await db.scalar('SELECT count(*) FROM sqlite_master');
    return db;
  } catch (error) {
    await db.close();
    // With a stored key this is a real fault, and the data may still be readable later.
    if (storedKey !== null) throw error;
    // The key is gone (the OS keystore was reset), so this file can never be read again.
    await driver.remove(ENCRYPTED_SYNC_DB);
    const fresh = await driver.open(ENCRYPTED_SYNC_DB);
    await fresh.exec(keyPragma(key));
    return fresh;
  }
}
