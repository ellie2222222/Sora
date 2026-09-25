/**
 * Non-sensitive per-viewer preferences (theme, locale) — unlike a refresh
 * token (secureStore.ts), there is nothing here worth encrypting, so a plain
 * AsyncStorage file is the right amount of ceremony. Read on cold start before
 * the authenticated user (and their server-stored preference) is known, so the
 * app never renders one frame in the wrong theme or language while waiting on
 * the network.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './secureStore.ts';

export const preferencesStore: KeyValueStore = {
  async get(key) {
    return AsyncStorage.getItem(key);
  },
  async set(key, value) {
    await AsyncStorage.setItem(key, value);
  },
  async remove(key) {
    await AsyncStorage.removeItem(key);
  },
};

export const THEME_STORAGE_KEY = 'finance.preferences.theme.v1';
export const THEME_MODE_STORAGE_KEY = 'finance.preferences.themeMode.v1';
export const LOCALE_STORAGE_KEY = 'finance.preferences.locale.v1';
/** Presence (`'true'`) means the app should resume in guest mode on cold start. */
export const GUEST_MODE_STORAGE_KEY = 'finance.preferences.guestMode.v1';
/** Kept outside the sync database on purpose, so a failed write there can't lose the decision (`resolvePreOwnershipRows`). */
export const PRE_OWNERSHIP_OWNER_STORAGE_KEY = 'finance.sync.preOwnershipOwner.v1';
