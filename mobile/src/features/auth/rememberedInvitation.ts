let rememberedToken: string | null = null;

/**
 * Signing in swaps the auth stack for the app stack, dropping the screen the link opened, so its token waits
 * here to reopen it. Memory only: the server still checks the accepter's email against the invitation (§8.5).
 */
export function rememberInvitation(token: string): void {
  rememberedToken = token;
}

export function takeRememberedInvitation(): string | null {
  const token = rememberedToken;
  rememberedToken = null;
  return token;
}
