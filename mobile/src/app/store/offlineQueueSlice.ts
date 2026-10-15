import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { QueuedMutation } from '@/services/sync';
import type { RootState } from './index.ts';

/**
 * A memory-only reactive mirror of the offline queue's SQLite rows — not a
 * second persistence layer. The rows' truth stays in `offlineQueueDb.ts`;
 * this slice exists so components can `useSelector` the queue the same way
 * they already do `auth`, instead of every row wiring its own
 * `offlineQueue.subscribe()` effect.
 */
interface OfflineQueueState {
  rows: QueuedMutation[];
}

const initialState: OfflineQueueState = { rows: [] };

const offlineQueueSlice = createSlice({
  name: 'offlineQueue',
  initialState,
  reducers: {
    queueRowsReplaced(state, action: PayloadAction<QueuedMutation[]>) {
      state.rows = action.payload;
    },
  },
});

export const { queueRowsReplaced } = offlineQueueSlice.actions;

/** Writes the server refused, oldest first: each waits on the user to try again or discard it. */
export const selectStuckRows = createSelector([(state: RootState) => state.offlineQueue.rows], (rows) =>
  rows.filter((row) => row.status === 'failed' || row.status === 'conflict'),
);

export const selectPendingCount = (state: RootState): number =>
  state.offlineQueue.rows.filter((row) => row.status === 'pending' || row.status === 'syncing').length;

export type AggregateSyncStatus = 'synced' | 'syncing' | 'pending' | 'failed';

/**
 * One glanceable status for the whole queue, in order of what most needs the
 * user's attention: an active pass outranks a stale failure (it may resolve
 * it), a failure outranks a merely-queued row, and only an empty/all-synced
 * queue reads as idle.
 */
export const selectSyncStatus = (state: RootState): AggregateSyncStatus => {
  const rows = state.offlineQueue.rows;
  if (rows.some((row) => row.status === 'syncing')) return 'syncing';
  if (rows.some((row) => row.status === 'failed' || row.status === 'conflict')) return 'failed';
  if (rows.some((row) => row.status === 'pending')) return 'pending';
  return 'synced';
};

/** A record's first row still waiting, else its first row: a synced create must not hide a failed edit. */
export const selectQueueEntryFor =
  (entity: QueuedMutation['entity'], localId: string) =>
  (state: RootState): QueuedMutation | null => {
    let first: QueuedMutation | null = null;
    for (const row of state.offlineQueue.rows) {
      if (row.entity !== entity || row.localId !== localId) continue;
      if (row.status !== 'synced') return row;
      first ??= row;
    }
    return first;
  };

export default offlineQueueSlice.reducer;
