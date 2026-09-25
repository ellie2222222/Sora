import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ENCRYPTED_SYNC_DB, openSyncDatabaseWith, PLAIN_SYNC_DB, type SyncDbDriver, type SyncDbHandle } from './syncDatabaseOpen.ts';

interface FakeFile {
  key: string | null;
  rows: string[];
}

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

/** Enough of SQLCipher to matter: a keyed file is unreadable under any other key, and export copies rows. */
function fakeSqlCipher(options: { cipher?: boolean; storedKey?: string | null; files?: Record<string, FakeFile> } = {}) {
  const files = new Map(Object.entries(options.files ?? {}));
  let storedKey = options.storedKey ?? null;
  const removed: string[] = [];
  const open: string[] = [];
  const failRemoving = new Set<string>();

  class Handle implements SyncDbHandle {
    readonly path: string;
    private key: string | null = null;
    private attached: string | null = null;
    private readonly name: string;

    constructor(name: string) {
      this.name = name;
      this.path = `/data/SQLite/${name}`;
    }

    private file(): FakeFile {
      const file = files.get(this.name);
      if (!file) throw new Error('file removed while open');
      if (file.key === null && file.rows.length === 0) file.key = this.key;
      if (file.key !== this.key) throw new Error('file is not a database');
      return file;
    }

    async exec(sql: string): Promise<void> {
      const pragma = /^PRAGMA key = "x'([0-9a-f]+)'"$/.exec(sql);
      const attach = /^ATTACH DATABASE '(.+)' AS encrypted KEY "x'([0-9a-f]+)'"$/.exec(sql);
      if (pragma) this.key = pragma[1] ?? null;
      else if (attach) {
        const name = (attach[1] ?? '').split('/').pop() ?? '';
        if (!files.has(name)) files.set(name, { key: attach[2] ?? null, rows: [] });
        this.attached = name;
      } else if (sql === "SELECT sqlcipher_export('encrypted')") {
        const target = files.get(this.attached ?? '');
        if (!target) throw new Error('nothing attached');
        if (target.rows.length > 0) throw new Error('table already exists');
        target.rows.push(...this.file().rows);
      } else if (sql === 'DETACH DATABASE encrypted') this.attached = null;
      else if (sql.startsWith('INSERT ')) this.file().rows.push(sql);
    }

    async scalar(sql: string): Promise<unknown> {
      assert.equal(sql, 'SELECT count(*) FROM sqlite_master');
      return this.file().rows.length > 0 ? 1 : 0;
    }

    async close(): Promise<void> {
      open.splice(open.indexOf(this.name), 1);
    }

    rows(): string[] {
      return this.file().rows;
    }
  }

  const driver: SyncDbDriver<Handle> = {
    cipherSupported: async () => options.cipher ?? true,
    open: async (name) => {
      if (!files.has(name)) files.set(name, { key: null, rows: [] });
      open.push(name);
      return new Handle(name);
    },
    remove: async (name) => {
      assert.ok(!open.includes(name), `${name} removed while open`);
      if (failRemoving.has(name)) throw new Error('disk error');
      if (!files.delete(name)) throw new Error('database not found');
      removed.push(name);
    },
    readKey: async () => storedKey,
    writeKey: async (key) => {
      storedKey = key;
    },
    newKey: () => KEY_A,
  };

  return { driver, files, removed, failRemoving, storedKey: () => storedKey };
}

describe('openSyncDatabaseWith', () => {
  it('uses the plain file and never makes a key when the build has no SQLCipher', async () => {
    const fake = fakeSqlCipher({ cipher: false, files: { [PLAIN_SYNC_DB]: { key: null, rows: ['queued write'] } } });
    const db = await openSyncDatabaseWith(fake.driver);
    assert.equal(db.path.endsWith(PLAIN_SYNC_DB), true);
    assert.deepEqual(db.rows(), ['queued write']);
    assert.equal(fake.storedKey(), null);
    assert.deepEqual(fake.removed, []);
  });

  it('creates a key and an encrypted file on a fresh install', async () => {
    const fake = fakeSqlCipher();
    const db = await openSyncDatabaseWith(fake.driver);
    assert.equal(fake.storedKey(), KEY_A);
    assert.equal(db.path.endsWith(ENCRYPTED_SYNC_DB), true);
    await db.exec('INSERT a row');
    assert.equal(fake.files.get(ENCRYPTED_SYNC_DB)?.key, KEY_A);
    assert.equal(fake.files.has(PLAIN_SYNC_DB), false);
  });

  it('copies an existing plain file, unsynced writes included, then removes it', async () => {
    const fake = fakeSqlCipher({ files: { [PLAIN_SYNC_DB]: { key: null, rows: ['queued write', 'saved read'] } } });
    const db = await openSyncDatabaseWith(fake.driver);
    assert.deepEqual(db.rows(), ['queued write', 'saved read']);
    assert.equal(fake.files.get(ENCRYPTED_SYNC_DB)?.key, KEY_A);
    assert.equal(fake.files.has(PLAIN_SYNC_DB), false);
  });

  it('redoes a copy an earlier launch left half done, from the plain file that is still there', async () => {
    const fake = fakeSqlCipher({
      storedKey: KEY_A,
      files: {
        [PLAIN_SYNC_DB]: { key: null, rows: ['queued write', 'saved read'] },
        [ENCRYPTED_SYNC_DB]: { key: KEY_A, rows: ['queued write'] },
      },
    });
    const db = await openSyncDatabaseWith(fake.driver);
    assert.deepEqual(db.rows(), ['queued write', 'saved read']);
  });

  it('fails the open when the plain file cannot be removed, and copies it again next launch', async () => {
    const fake = fakeSqlCipher({ files: { [PLAIN_SYNC_DB]: { key: null, rows: ['queued write'] } } });
    fake.failRemoving.add(PLAIN_SYNC_DB);
    await assert.rejects(openSyncDatabaseWith(fake.driver), /disk error/);

    fake.failRemoving.clear();
    const db = await openSyncDatabaseWith(fake.driver);
    assert.deepEqual(db.rows(), ['queued write']);
    assert.equal(fake.files.has(PLAIN_SYNC_DB), false);
  });

  it('opens an existing encrypted file with the stored key and copies nothing', async () => {
    const fake = fakeSqlCipher({ storedKey: KEY_B, files: { [ENCRYPTED_SYNC_DB]: { key: KEY_B, rows: ['queued write'] } } });
    const db = await openSyncDatabaseWith(fake.driver);
    assert.deepEqual(db.rows(), ['queued write']);
    assert.equal(fake.storedKey(), KEY_B);
  });

  it('starts over when the key is gone, since that file can never be read again', async () => {
    const fake = fakeSqlCipher({ storedKey: null, files: { [ENCRYPTED_SYNC_DB]: { key: KEY_B, rows: ['unreadable'] } } });
    const db = await openSyncDatabaseWith(fake.driver);
    assert.deepEqual(db.rows(), []);
    assert.equal(fake.files.get(ENCRYPTED_SYNC_DB)?.key, KEY_A);
  });

  it('refuses, and deletes nothing, when a stored key does not open the file', async () => {
    const fake = fakeSqlCipher({ storedKey: KEY_A, files: { [ENCRYPTED_SYNC_DB]: { key: KEY_B, rows: ['queued write'] } } });
    await assert.rejects(openSyncDatabaseWith(fake.driver), /file is not a database/);
    assert.deepEqual(fake.files.get(ENCRYPTED_SYNC_DB)?.rows, ['queued write']);
  });

  it('refuses a malformed stored key before running any SQL with it', async () => {
    const fake = fakeSqlCipher({ storedKey: `x"; DROP TABLE t; --`, files: { [PLAIN_SYNC_DB]: { key: null, rows: ['queued write'] } } });
    await assert.rejects(openSyncDatabaseWith(fake.driver), /malformed/);
    assert.deepEqual(fake.files.get(PLAIN_SYNC_DB)?.rows, ['queued write']);
  });
});
