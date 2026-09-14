/**
 * The app's one offline-queue instance — mirrors `guestStorage.ts`: the class
 * in `offlineQueue.ts` stays free of native imports so it is unit-testable,
 * and the SQLite wiring (`offlineQueueDb.ts`) is pulled in only here.
 */

import { offlineQueueDb } from './offlineQueueDb.ts';
import { OfflineQueue } from './offlineQueue.ts';

export const offlineQueue = new OfflineQueue(offlineQueueDb);
