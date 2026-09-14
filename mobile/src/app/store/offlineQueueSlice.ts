import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { QueuedMutation } from '../../services/sync/offlineQueueTypes.ts';
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

export const selectQueueRows = (state: RootState): QueuedMutation[] => state.offlineQueue.rows;

export const selectPendingCount = (state: RootState): number =>
  state.offlineQueue.rows.filter((row) => row.status === 'pending' || row.status === 'syncing').length;

export const selectQueueEntryFor =
  (entity: QueuedMutation['entity'], localId: string) =>
  (state: RootState): QueuedMutation | null =>
    state.offlineQueue.rows.find((row) => row.entity === entity && row.localId === localId) ?? null;

export default offlineQueueSlice.reducer;
