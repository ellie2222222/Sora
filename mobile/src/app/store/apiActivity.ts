import { apiSlice } from './api/apiSlice.ts';
import type { RootState } from './index.ts';

/** Whether any read is in flight on any endpoint: what "the new screen's data has arrived" waits on. */
export const selectAnyQueryPending = (state: RootState): boolean =>
  Object.values(state[apiSlice.reducerPath].queries).some((query) => query?.status === 'pending');
