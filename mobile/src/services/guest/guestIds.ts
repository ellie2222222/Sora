/**
 * Ids for guest-created records.
 *
 * The generator is registered rather than imported so this module — and
 * therefore every guest API that mints an id — stays loadable without React
 * Native, the same seam `guestStore.ts` uses for persistence. `expo-crypto`
 * is wired in by `guestRuntime.ts` at app startup.
 *
 * Nothing in `@sora/contracts`' response types distinguishes a server-issued
 * id from a client one (`id: string` everywhere), so a locally-generated
 * UUID satisfies every interface hooks and screens already expect.
 */

export type IdGenerator = () => string;

/**
 * Web Crypto is the default because it is genuinely present under Node (so
 * tests need no registration) — but Hermes does not ship it, which is why
 * `expo-crypto` still has to be registered on device. A missing generator
 * throws rather than falling back to `Math.random`: a weak id here would
 * collide silently and only surface as two records sharing a row.
 */
let generate: IdGenerator = () => {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  throw new Error('guestIds: no UUID source — registerIdGenerator() was not called at startup');
};

export function registerIdGenerator(generator: IdGenerator): void {
  generate = generator;
}

export function newLocalId(): string {
  return generate();
}

/**
 * The fixed pseudo-identity guest-mode responses attribute records to,
 * everywhere a real response would carry a `createdBy` or `ownerUserId` from
 * `users`. There is no such row in guest mode — this stands in for it
 * consistently across `guestTransactions.ts` and `guestWallets.ts` rather
 * than each inventing its own placeholder.
 */
export const GUEST_USER_ID = 'guest';
export const GUEST_USER: { id: string; displayName: string } = {
  id: GUEST_USER_ID,
  displayName: 'You',
};
