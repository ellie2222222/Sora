/**
 * A release build sends bearer and refresh tokens to this URL, so cleartext
 * `http:` is refused outside development unless explicitly opted into (a LAN
 * preview build against a dev server).
 */
export function assertSecureApiUrl(url: string, isDev: boolean, allowInsecure: boolean): string {
  if (isDev || allowInsecure || url.startsWith('https://')) return url;
  throw new Error(
    `EXPO_PUBLIC_API_BASE_URL must use https:// in a release build (got ${url}); ` +
      'set EXPO_PUBLIC_ALLOW_INSECURE_API=true only for a LAN preview build.',
  );
}
