/**
 * Shared fakes for the sync-layer tests. Not a `.test.ts` file so `node
 * --test`'s glob does not try to run it — mirrors `services/guest/testSupport.ts`.
 */

import { MemoryQueueDb } from './memoryQueueDb.ts';
import type { QueueDb } from './offlineQueueDb.ts';

/** The production in-memory queue, so these tests can't drift from what the web build runs. */
export function memoryQueueDb(): QueueDb {
  return new MemoryQueueDb();
}

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
