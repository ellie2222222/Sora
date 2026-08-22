'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  /** Shows a transient message without disturbing what is on screen. */
  toast: (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Auto-dismiss delay. Long enough to read a sentence, short enough not to linger. */
const TOAST_TTL_MS = 5000

const TONE: Record<ToastType, { classes: string; icon: React.ReactNode }> = {
  success: {
    classes:
      'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100',
    icon: <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
  },
  error: {
    classes:
      'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100',
    icon: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
  },
  warning: {
    classes:
      'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-100',
    icon: <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />,
  },
  info: {
    classes:
      'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100',
    icon: <Info className="h-5 w-5 text-gray-500 dark:text-gray-400" />,
  },
}

/**
 * Transient feedback (FE-06). Used where a failure must not replace the screen —
 * a workspace switch that fails, for instance, keeps the current workspace visible
 * and reports the problem here instead of swapping in a full-page error.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      // Monotonic counter rather than a timestamp: two toasts raised in the same
      // millisecond would otherwise collide on their React key.
      setToasts((current) => {
        const id = (current[current.length - 1]?.id ?? 0) + 1
        setTimeout(() => dismiss(id), TOAST_TTL_MS)
        return [...current, { id, type, message }]
      })
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        id="toast-viewport"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            id={`toast-${item.type}`}
            role={item.type === 'error' ? 'alert' : 'status'}
            className={`animate-slide-in-right pointer-events-auto flex w-full max-w-sm gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              TONE[item.type].classes
            }`}
          >
            <div className="shrink-0">{TONE[item.type].icon}</div>
            <p className="flex-1 text-sm">{item.message}</p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dismiss(item.id)}
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return context
}
