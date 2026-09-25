/** The app's one read cache, mirroring `offlineQueueInstance.ts`: SQLite wiring is pulled in only here. */

import { LocalCache } from './localCache.ts';
import { localCacheDb } from './localCacheDb.ts';

export const localCache = new LocalCache(localCacheDb);
