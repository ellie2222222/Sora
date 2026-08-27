import React from 'react'

interface EmptyStateProps {
  /** Lucide icon element, sized by the caller (FE-05). */
  icon?: React.ReactNode
  title: string
  /** Guidance telling the member what to do next (DASH-US-01 empty state). */
  hint?: string
  action?: React.ReactNode
  id?: string
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  hint,
  action,
  id,
  className = '',
}) => (
  <div
    id={id}
    className={`flex flex-col items-center justify-center gap-3 px-4 py-10 text-center ${className}`}
  >
    {icon && (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        {icon}
      </div>
    )}
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
      {hint && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
    {action}
  </div>
)
