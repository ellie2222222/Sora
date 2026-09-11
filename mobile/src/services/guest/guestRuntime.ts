/**
 * Wires the platform pieces the guest layer's seams expect.
 *
 * Imported for its side effect by `App.tsx`, at module scope, so it runs
 * before any screen or provider can reach guest code. `guestIds.ts` throws
 * rather than falling back to a weak id source when this has not run, so a
 * missed registration fails loudly on the first guest write instead of
 * quietly minting collidable ids.
 */

import * as Crypto from 'expo-crypto';

import { registerIdGenerator } from './guestIds.ts';

registerIdGenerator(() => Crypto.randomUUID());
