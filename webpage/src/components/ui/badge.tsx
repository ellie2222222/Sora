import React from 'react'

/**
 * Tone carries meaning where a value is categorical:
 *   income/expense — direction of money
 *   danger         — a cancelled or failed record
 *   muted          — archived, inactive, or otherwise not selectable
 *   neutral        — a plain label (currency code, account type)
 */
export type BadgeTone = 'neutral' | 'muted' | 'income' | 'expense' | 'danger'

export interface BadgeProps {
  id?: string
  tone?: BadgeTone
  /** Rendered before the label at 12px; keep to Lucide icons (FE-05). */
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  muted: 'bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400',
  income: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  expense: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

/** Short, high-contrast label for a categorical value on a list row. */
export function Badge({ id, tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      id={id}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        TONE_STYLES[tone]
      } ${className || ''}`}
    >
      {icon}
      {children}
    </span>
  )
}
