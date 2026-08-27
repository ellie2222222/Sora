import React from 'react'
import { Spinner } from './spinner'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `success` is the green variant reserved for create actions; `destructive`
   * and `warning` match the ConfirmDialog variants of the same name and should
   * only ever appear on the confirming button of such a dialog.
   */
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/**
 * Icon + label must share one line. Tailwind's preflight makes `svg` a block
 * element, so anything less than a real flex row here puts the icon on its own
 * line above the text. These few properties are inline rather than utility
 * classes so the layout cannot be broken by a caller's `className`, a purge
 * miss, or a stale stylesheet — the visual styling stays in classes.
 */
const INLINE_ROW: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  whiteSpace: 'nowrap',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, style, children, ...props }, ref) => {
    const baseStyles =
      'font-medium rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed [&>svg]:shrink-0'

    const variantStyles = {
      primary: 'bg-slate-800 text-white hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100 active:bg-slate-900',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 active:bg-gray-400',
      success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:text-white dark:hover:bg-green-700',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-600 dark:text-white dark:hover:bg-red-700',
      warning: 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-700',
    }

    const sizeStyles = {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    const spinnerSizeMap = {
      sm: 'sm',
      md: 'sm',
      lg: 'md',
    } as const

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
        style={{ ...INLINE_ROW, ...style }}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Spinner size={spinnerSizeMap[size]} />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
