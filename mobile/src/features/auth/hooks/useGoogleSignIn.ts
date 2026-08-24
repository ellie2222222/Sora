/**
 * Google sign-in via the implicit `id_token` flow — the app never sees or
 * exchanges an authorization code, it hands the API exactly the ID token
 * `POST /auth/google` already verifies server-side against Google's own
 * signing keys (never trusting the client's own reading of the token).
 *
 * Not usable until real client ids are configured (env.googleClientId*,
 * from .env.example) — see mobile/GAPS.md. Untestable in this environment,
 * since exercising it needs a real Google Cloud OAuth client.
 */

import * as AuthSession from 'expo-auth-session';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { env } from '../../../app/config/env.ts';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function clientIdForPlatform(): string | undefined {
  if (Platform.OS === 'ios') return env.googleClientIdIos ?? env.googleClientIdWeb;
  if (Platform.OS === 'android') return env.googleClientIdAndroid ?? env.googleClientIdWeb;
  return env.googleClientIdWeb;
}

/**
 * Google's implicit id_token flow expects a `nonce` (OIDC §3.2.2.1). It only
 * has to be unique per attempt to be useful against replay — same reasoning
 * as client.ts's Idempotency-Key — so `Math.random()` is enough and avoids an
 * async crypto call inside a hook whose config must build synchronously.
 */
function requestNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface GoogleSignInResult {
  /** false when no client id is configured for this platform — callers should hide the button. */
  available: boolean;
  signIn: () => Promise<string | null>;
}

export function useGoogleSignIn(): GoogleSignInResult {
  const clientId = clientIdForPlatform();
  const nonce = useMemo(() => requestNonce(), []);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? 'unconfigured',
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ['openid', 'email', 'profile'],
      redirectUri: AuthSession.makeRedirectUri(),
      usePKCE: false,
      extraParams: { nonce },
    },
    GOOGLE_DISCOVERY,
  );

  const signIn = useMemo(
    () => async (): Promise<string | null> => {
      if (clientId === undefined || request === null) return null;
      const result = await promptAsync();
      if (result.type !== 'success') return null;
      return result.params.id_token ?? null;
    },
    [clientId, request, promptAsync],
  );

  return { available: clientId !== undefined, signIn };
}
