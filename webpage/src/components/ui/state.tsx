import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './button'
import { Spinner } from './spinner'

/**
 * The three states every data-backed screen passes through. Pages render these
 * instead of hand-rolling a spinner block or an error alert, so loading, empty
 * and failed all look the same wherever they appear (FE-06).
 *
 * `EmptyState` lives in ./empty-state and is re-exported here so a page can pull
 * all three from one import.
 */
export { EmptyState } from './empty-state'

export interface LoadingStateProps {
  /** Shown next to the spinner; omit for a bare spinner. */
  label?: string
  /** `page` fills the viewport area, `section` sits inside a card or panel. */
  size?: 'page' | 'section'
  id?: string
  className?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  size = 'page',
  id = 'state-loading',
  className = '',
}) => (
  <div
    id={id}
    role="status"
    aria-live="polite"
    className={`flex items-center justify-center gap-3 text-gray-600 dark:text-gray-300 ${
      size === 'page' ? 'py-16' : 'py-8'
    } ${className}`}
  >
    <Spinner size={size === 'page' ? 'lg' : 'md'} />
    {label && <span>{label}</span>}
  </div>
)

export interface ErrorStateProps {
  /** Human-readable message; already translated by the caller. */
  message: string
  /** Rendered as a retry button when provided. */
  onRetry?: () => void
  retryLabel?: string
  id?: string
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  retryLabel,
  id = 'message-error',
  className = '',
}) => (
  <div
    id={id}
    role="alert"
    className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-800 dark:bg-red-900/20 ${className}`}
  >
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400">
      <AlertTriangle className="h-5 w-5" />
    </div>
    <p className="max-w-sm text-sm text-red-900 dark:text-red-200">{message}</p>
    {onRetry && retryLabel && (
      <Button id="btn-retry" variant="secondary" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  </div>
)
