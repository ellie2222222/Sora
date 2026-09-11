import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from './index.ts';

/** Mirrors `AuthProvider`'s `isGuest` — RTK Query `queryFn` endpoints see Redux state, not React context. */
interface AuthState {
  isGuest: boolean;
}

const initialState: AuthState = {
  isGuest: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setIsGuest(state, action: PayloadAction<boolean>) {
      state.isGuest = action.payload;
    },
  },
});

export const { setIsGuest } = authSlice.actions;
export const selectIsGuest = (state: RootState): boolean => state.auth.isGuest;
export default authSlice.reducer;
