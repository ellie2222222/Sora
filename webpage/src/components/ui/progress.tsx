import React from 'react'

interface ProgressProps {
  /** Completion percentage. Values outside 0-100 are clamped for display. */
  value: number
  /** Visual state — carries meaning beyond colour via the accessible label (SRS §6.1). */
  tone?: 'default' | 'warning' | 'danger' | 'success'
  label?: string
  className?: string
  id?: string
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  tone = 'default',
  label,
  className = '',
  id,
}) => {
  const clamped = Math.min(100, Math.max(0, value))

  const toneStyles = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  }[tone]

  return (
    <div
      id={id}
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${toneStyles}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
