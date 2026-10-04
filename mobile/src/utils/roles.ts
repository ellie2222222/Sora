/**
 * Role gating for the UI.
 *
 * The API enforces every one of these independently; hiding a control is a
 * courtesy so a VIEWER is not offered an action that can only fail. It is not a
 * security boundary, and nothing here may be the only check on a write.
 */

import { REQUIRED_ROLE, roleSatisfies, WalletRole } from '@sora/contracts';

export interface WalletPermissions {
  canRead: boolean;
  canWrite: boolean;
  canAdminister: boolean;
}

export function canRead(role: WalletRole | null): boolean {
  return roleSatisfies(role, REQUIRED_ROLE.READ);
}

export function canWrite(role: WalletRole | null): boolean {
  return roleSatisfies(role, REQUIRED_ROLE.WRITE);
}

export function canAdminister(role: WalletRole | null): boolean {
  return roleSatisfies(role, REQUIRED_ROLE.ADMINISTER);
}

export function permissionsFor(role: WalletRole | null): WalletPermissions {
  return {
    canRead: canRead(role),
    canWrite: canWrite(role),
    canAdminister: canAdminister(role),
  };
}

/**
 * A cross-wallet transfer needs write access on both sides — read-only access to
 * someone's wallet must not let you push money into it (API spec §2.5).
 */
export function canTransferBetween(
  fromRole: WalletRole | null,
  toRole: WalletRole | null,
): boolean {
  return canWrite(fromRole) && canWrite(toRole);
}

/** Permissions on one wallet out of the caller's list, e.g. an account's own wallet rather than the active one. */
export function permissionsForWallet(
  wallets: readonly { id: string; role: WalletRole | null }[],
  walletId: string,
): WalletPermissions {
  return permissionsFor(wallets.find((wallet) => wallet.id === walletId)?.role ?? null);
}

/**
 * Whether the viewer may change this member's role or remove them: owners manage others' access,
 * but never their own row nor the owner's (ownership moves only by transfer).
 */
export function canManageMember(
  viewerRole: WalletRole | null,
  member: { userId: string; role: WalletRole },
  viewerUserId: string | undefined,
): boolean {
  return canAdminister(viewerRole) && member.userId !== viewerUserId && member.role !== WalletRole.OWNER;
}

export const ROLE_LABELS: Record<WalletRole, string> = {
  [WalletRole.OWNER]: 'Owner',
  [WalletRole.EDITOR]: 'Editor',
  [WalletRole.VIEWER]: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<WalletRole, string> = {
  [WalletRole.OWNER]: 'Full control, including members and roles',
  [WalletRole.EDITOR]: 'Can add and edit money records',
  [WalletRole.VIEWER]: 'Can look, cannot change anything',
};

export function getRoleLabel(role: WalletRole, t?: (key: string) => string): string {
  if (!t) return ROLE_LABELS[role];
  const key = `roles.${role.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : ROLE_LABELS[role];
}

export function getRoleDescription(role: WalletRole, t?: (key: string) => string): string {
  if (!t) return ROLE_DESCRIPTIONS[role];
  const key = `roles.${role.toLowerCase()}Desc`;
  const translated = t(key);
  return translated !== key ? translated : ROLE_DESCRIPTIONS[role];
}
