import { configureStore } from '@reduxjs/toolkit';

import { apiSlice } from './api/apiSlice.ts';
import authReducer from './authSlice.ts';
import { localCacheMiddleware } from './localCacheMiddleware.ts';
import offlineQueueReducer from './offlineQueueSlice.ts';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    offlineQueue: offlineQueueReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        warnAfter: 128,
      },
      immutableCheck: {
        warnAfter: 128,
      },
    }).concat(apiSlice.middleware, localCacheMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export * from './api/index.ts';
export * from './authSlice.ts';
export * from './hooks.ts';
export * from './offlineQueueSlice.ts';
