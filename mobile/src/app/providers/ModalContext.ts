import { createContext, useContext } from 'react';
import type { AccountType } from '@sora/contracts';

/**
 * Split out of `ModalProvider.tsx` so the barrel can export `useModal` safely:
 * this file has no cross-feature imports, unlike `ModalProvider.tsx` itself
 * (which pulls in every feature's modal component and stays barrel-excluded
 * for that reason — see `index.ts`).
 */

export type ModalType =
  | 'AddTransaction'
  | 'EditTransaction'
  | 'AddAccount'
  | 'AddGoal'
  | 'AddBudget'
  | 'AddContribution'
  | 'CreateWallet';

export interface ModalParams {
  transactionId?: string;
  walletId?: string;
  goalId?: string;
  /** Preselects the new account's type, for a caller that already knows which kind is being added. */
  accountType?: AccountType;
}

export interface ModalContextValue {
  openModal: (type: ModalType, params?: ModalParams) => void;
  closeModal: () => void;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (context === null) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
