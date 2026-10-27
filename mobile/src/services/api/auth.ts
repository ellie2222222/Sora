import {
  ROUTES,
  apiUrl,
  type AuthResponse,
  type ConfirmEmailVerificationRequest,
  type EmailVerificationSentResponse,
  type GoogleAuthRequest,
  type LoginRequest,
  type RegisterRequest,
  type UpdatePreferencesRequest,
  type UserResponse,
} from '@sora/contracts';

import { getOne, patchOne, postOne, postVoid } from './client.ts';

export const authApi = {
  register(body: RegisterRequest): Promise<AuthResponse> {
    return postOne<AuthResponse>(apiUrl(ROUTES.auth.register()), body);
  },
  login(body: LoginRequest): Promise<AuthResponse> {
    return postOne<AuthResponse>(apiUrl(ROUTES.auth.login()), body);
  },
  google(body: GoogleAuthRequest): Promise<AuthResponse> {
    return postOne<AuthResponse>(apiUrl(ROUTES.auth.google()), body);
  },
  me(): Promise<UserResponse> {
    return getOne<UserResponse>(apiUrl(ROUTES.auth.me()));
  },
  updatePreferences(body: UpdatePreferencesRequest): Promise<UserResponse> {
    return patchOne<UserResponse>(apiUrl(ROUTES.auth.preferences()), body);
  },
  sendEmailVerification(): Promise<EmailVerificationSentResponse> {
    return postOne<EmailVerificationSentResponse>(apiUrl(ROUTES.auth.sendEmailVerification()), {});
  },
  confirmEmailVerification(body: ConfirmEmailVerificationRequest): Promise<UserResponse> {
    return postOne<UserResponse>(apiUrl(ROUTES.auth.confirmEmailVerification()), body);
  },
  logout(refreshToken?: string): Promise<void> {
    return postVoid(apiUrl(ROUTES.auth.logout()), refreshToken === undefined ? {} : { refreshToken });
  },
};
