/**
 * Token storage.
 *
 * expo-secure-store is Keychain-backed on iOS and Keystore-backed on Android
 * (MB-04). AsyncStorage is deliberately not used: it is a plain unencrypted
 * file, so a refresh token in it is readable on a rooted device or from a
 * filesystem backup.
 *
 * Web has no such store. The web target exists only to prove the bundle builds
 * in an environment with no Android SDK or Xcode, so it falls back to memory —
 * which loses the session on reload rather than writing a token somewhere it
 * would not be protected.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };
}

const nativeStore: KeyValueStore = {
  async get(key) {
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    await SecureStore.deleteItemAsync(key);
  },
};

export const secureStore: KeyValueStore =
  Platform.OS === 'web' ? memoryStore() : nativeStore;

export const SESSION_STORAGE_KEY = 'finance.session.v1';
