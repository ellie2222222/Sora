/**
 * Endpoint paths, written once.
 *
 * The API mounts its controllers from these and the app's client builds its URLs
 * from them, so a renamed route cannot leave one side calling the old path. Kept
 * as functions rather than template strings so a missing path parameter is a type
 * error instead of a literal ":id" reaching the server.
 */

export const API_PREFIX = '/api/v1';

export const ROUTES = {
  health: () => '/health',

  auth: {
    register: () => '/auth/register',
    login: () => '/auth/login',
    google: () => '/auth/google',
    refresh: () => '/auth/refresh',
    logout: () => '/auth/logout',
    me: () => '/auth/me',
    preferences: () => '/auth/me/preferences',
  },

  wallets: {
    list: () => '/wallets',
    create: () => '/wallets',
    detail: (walletId: string) => `/wallets/${walletId}`,
    update: (walletId: string) => `/wallets/${walletId}`,
    archive: (walletId: string) => `/wallets/${walletId}`,

    members: (walletId: string) => `/wallets/${walletId}/members`,
    member: (walletId: string, memberId: string) => `/wallets/${walletId}/members/${memberId}`,
    transferOwnership: (walletId: string) => `/wallets/${walletId}/transfer-ownership`,
    leave: (walletId: string) => `/wallets/${walletId}/leave`,

    invitations: (walletId: string) => `/wallets/${walletId}/invitations`,
    invitation: (walletId: string, invitationId: string) =>
      `/wallets/${walletId}/invitations/${invitationId}`,
  },

  invitations: {
    /** Preview an invitation by token before accepting it. */
    preview: () => '/invitations/preview',
    accept: () => '/invitations/accept',
  },

  accounts: {
    list: () => '/accounts',
    create: () => '/accounts',
    detail: (accountId: string) => `/accounts/${accountId}`,
    update: (accountId: string) => `/accounts/${accountId}`,
    archive: (accountId: string) => `/accounts/${accountId}`,
  },

  categories: {
    list: () => '/categories',
    create: () => '/categories',
    detail: (categoryId: string) => `/categories/${categoryId}`,
    update: (categoryId: string) => `/categories/${categoryId}`,
    archive: (categoryId: string) => `/categories/${categoryId}`,
  },

  transactions: {
    list: () => '/transactions',
    create: () => '/transactions',
    detail: (transactionId: string) => `/transactions/${transactionId}`,
    update: (transactionId: string) => `/transactions/${transactionId}`,
    cancel: (transactionId: string) => `/transactions/${transactionId}/cancel`,
  },

  budgets: {
    list: () => '/budgets',
    create: () => '/budgets',
    detail: (budgetId: string) => `/budgets/${budgetId}`,
    update: (budgetId: string) => `/budgets/${budgetId}`,
    archive: (budgetId: string) => `/budgets/${budgetId}`,
  },

  goals: {
    list: () => '/goals',
    create: () => '/goals',
    detail: (goalId: string) => `/goals/${goalId}`,
    update: (goalId: string) => `/goals/${goalId}`,
    archive: (goalId: string) => `/goals/${goalId}`,
    contributions: (goalId: string) => `/goals/${goalId}/contributions`,
    contribution: (goalId: string, contributionId: string) =>
      `/goals/${goalId}/contributions/${contributionId}`,
  },

  dashboard: {
    summary: () => '/dashboard',
  },

  audit: {
    list: (walletId: string) => `/wallets/${walletId}/audit-logs`,
  },
} as const;

/** Prefix a route with the version base path. */
export function apiUrl(path: string): string {
  return `${API_PREFIX}${path}`;
}
