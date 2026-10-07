// Fixtures through the public API only, shared by the integration harness and mobile/e2e/seed.mts;
// no Nest imports, because the seed runs under plain Node.

import { randomUUID } from 'node:crypto';

// Bodies are asserted field by field, so an untyped default keeps the tests readable.
export interface ApiResponse<T = any> {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: { success: boolean; message?: string; data: T; error?: { code: string; fields?: Record<string, string[]>; params?: Record<string, unknown> }; meta?: any } | null;
}

export interface ApiCaller {
  call<T = any>(method: string, path: string, options?: { body?: unknown; token?: string; headers?: Record<string, string> }): Promise<ApiResponse<T>>;
}

export interface ProbeUser {
  id: string;
  email: string;
  password: string;
  token: string;
  refreshToken: string;
  /** The personal wallet registration creates, seeded with starter categories. */
  walletId: string;
}

export async function registerProbeUser(api: ApiCaller, tag = 'user'): Promise<ProbeUser> {
  const unique = randomUUID();
  const email = `probe+${tag}-${unique}@example.invalid`;
  const password = `probe-pw-${unique}`;
  const registered = await api.call('POST', '/auth/register', { body: { email, password, displayName: `probe-${tag}`, timeZone: 'Asia/Ho_Chi_Minh' } });
  if (registered.status !== 201) throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  const token = registered.body!.data.tokens.accessToken as string;
  const wallets = await api.call('GET', '/wallets', { token });
  return {
    id: registered.body!.data.user.id,
    email,
    password,
    token,
    refreshToken: registered.body!.data.tokens.refreshToken,
    walletId: wallets.body!.data[0].id,
  };
}

export async function createAccount(
  api: ApiCaller,
  user: ProbeUser,
  walletId: string,
  options: { currency?: string; initialBalance?: string; name?: string } = {},
): Promise<string> {
  const response = await api.call('POST', '/accounts', {
    token: user.token,
    body: {
      walletId,
      name: options.name ?? `probe-${randomUUID()}`,
      type: 'BANK_ACCOUNT',
      currency: options.currency ?? 'VND',
      initialBalance: options.initialBalance ?? '0',
    },
  });
  if (response.status !== 201) throw new Error(`account create failed: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body!.data.id;
}

export async function categoryOf(api: ApiCaller, user: ProbeUser, walletId: string, type: 'EXPENSE' | 'INCOME'): Promise<string> {
  const response = await api.call('GET', `/categories?walletId=${walletId}&type=${type}&pageSize=200`, { token: user.token });
  const category = (response.body?.data ?? []).find((candidate: { type: string }) => candidate.type === type);
  if (!category) throw new Error(`no ${type} category in wallet ${walletId}`);
  return category.id;
}

/** Makes `invitee` a member of `owner`'s wallet with `role`, through the real invitation flow. */
export async function addMember(
  api: ApiCaller,
  owner: ProbeUser,
  walletId: string,
  invitee: ProbeUser,
  role: 'EDITOR' | 'VIEWER',
): Promise<void> {
  const invite = await api.call('POST', `/wallets/${walletId}/invitations`, { token: owner.token, body: { email: invitee.email, role } });
  if (invite.status !== 201) throw new Error(`invite failed: ${invite.status} ${JSON.stringify(invite.body)}`);
  const accept = await api.call('POST', '/invitations/accept', { token: invitee.token, body: { token: invite.body!.data.token } });
  if (accept.status >= 300) throw new Error(`accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
}

export const nowIso = (): string => new Date().toISOString();
