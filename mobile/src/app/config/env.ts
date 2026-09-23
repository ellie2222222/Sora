/**
 * Runtime configuration.
 *
 * Only `EXPO_PUBLIC_*` names are inlined into the bundle by Expo, so any value
 * the app reads at runtime must carry that prefix — a plain `API_BASE_URL`
 * silently becomes `undefined` in a release build.
 *
 * The default targets the API on the host loopback. On a physical device that is
 * the device's own loopback, not the developer's machine, which is why
 * .env.example spells out using the LAN address there.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 15000;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function numberFrom(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  apiBaseUrl: trimTrailingSlashes(process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL),
  requestTimeoutMs: numberFrom(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  defaultCurrency: process.env.EXPO_PUBLIC_DEFAULT_CURRENCY ?? 'VND',
  defaultLocale: process.env.EXPO_PUBLIC_LOCALE ?? 'vi-VN',
  /**
   * Google issues a separate OAuth client id per platform surface (Expo Go's
   * proxy redirect needs the "Web application" one; a standalone iOS/Android
   * build needs its own, tied to the bundle id / package name + SHA1). All
   * three are optional so the app still runs without Google sign-in configured
   * — LoginScreen hides the button rather than rendering one that would 400.
   */
  googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
} as const;
