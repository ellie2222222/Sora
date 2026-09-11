/**
 * The app's one guest-ledger instance, and the only place in the guest layer
 * that touches React Native.
 *
 * Mirrors `services/auth/index.ts`: the class in `guestStore.ts` stays free of
 * platform imports so it is unit-testable, and the AsyncStorage wiring lives
 * here. AsyncStorage rather than `expo-secure-store` is deliberate — this is
 * a local ledger, not a credential (MB-04 covers tokens only), and a wallet's
 * worth of records is far past what the Keychain is meant to hold.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { GuestStore, type GuestPersistence } from './guestStore.ts';

export const GUEST_STORE_KEY = 'finance.guest.v1';

const persistence: GuestPersistence = {
  async load() {
    return AsyncStorage.getItem(GUEST_STORE_KEY);
  },
  async save(serialized) {
    await AsyncStorage.setItem(GUEST_STORE_KEY, serialized);
  },
  async clear() {
    await AsyncStorage.removeItem(GUEST_STORE_KEY);
  },
};

export const guestStore = new GuestStore(persistence);
