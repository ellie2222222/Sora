/**
 * Only the ID token reaches `POST /auth/google`, which checks it against `GOOGLE_CLIENT_ID`. Google redirects only
 * to the app owning the client id (package `com.sora.app` + signing SHA-1), so Expo Go can never finish this.
 */

import * as Google from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { env } from '@/app/config';

/** Covers the account picker plus the code exchange; past it the button stops spinning instead of hanging. */
const EXCHANGE_TIMEOUT_MS = 60_000;

function clientIdForPlatform(): string | undefined {
  if (Platform.OS === 'ios') return env.googleClientIdIos ?? env.googleClientIdWeb;
  if (Platform.OS === 'android') return env.googleClientIdAndroid ?? env.googleClientIdWeb;
  return env.googleClientIdWeb;
}

export interface GoogleSignInResult {
  /** false when no client id is configured for this platform — callers should hide the button. */
  available: boolean;
  signIn: () => Promise<string | null>;
}

export function useGoogleSignIn(): GoogleSignInResult {
  const clientId = clientIdForPlatform();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: clientId ?? 'unconfigured',
    webClientId: env.googleClientIdWeb,
    iosClientId: env.googleClientIdIos,
    androidClientId: env.googleClientIdAndroid,
    selectAccount: true,
  });
  const waiting = useRef<((idToken: string | null) => void) | null>(null);

  // On native the ID token arrives only after the provider's own code exchange, as a later `response`.
  useEffect(() => {
    if (response === null || waiting.current === null) return;
    const idToken = response.type === 'success' ? response.params.id_token : undefined;
    waiting.current(idToken ? idToken : null);
    waiting.current = null;
  }, [response]);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (clientId === undefined || request === null) return null;
    const answered = new Promise<string | null>((resolve) => {
      waiting.current = resolve;
      setTimeout(() => {
        if (waiting.current === resolve) {
          waiting.current = null;
          resolve(null);
        }
      }, EXCHANGE_TIMEOUT_MS);
    });
    const result = await promptAsync();
    if (result.type !== 'success') {
      waiting.current = null;
      return null;
    }
    return answered;
  }, [clientId, request, promptAsync]);

  return { available: clientId !== undefined, signIn };
}
