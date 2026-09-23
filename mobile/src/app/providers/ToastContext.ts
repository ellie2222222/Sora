import { createContext, useContext } from 'react';

/**
 * Split out of `ToastProvider.tsx` so the barrel can export `useToast` safely,
 * mirroring `ModalContext.ts` — this file has no cross-feature imports.
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
