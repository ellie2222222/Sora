import { deviceTimeZone } from '../../utils/date.ts';
import type { GuestWallet } from './guestStore.ts';

/** The guest wallet's calendar zone: set from the device when it was seeded, the device's for a store older than zones. */
export function guestTimeZone(wallet: Pick<GuestWallet, 'timeZone'> | null): string {
  return wallet?.timeZone ?? deviceTimeZone();
}
