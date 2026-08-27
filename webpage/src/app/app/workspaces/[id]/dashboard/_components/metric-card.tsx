import React from 'react'
import { Card } from '@/components/ui/card'

interface MetricCardProps {
  id: string
  label: string
  /** Pre-formatted value, or null when no data is available yet. */
  value: string | null
  sublabel?: string
  icon: React.ReactNode
  /** Colours the value; never the sole carrier of meaning (SDS §3.1 accessibility). */
  tone?: 'neutral' | 'positive' | 'negative'
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  label,
  value,
  sublabel,
  icon,
  tone = 'neutral',
}) => {
  const valueTone = {
    neutral: 'text-gray-900 dark:text-white',
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
  }[tone]

  return (
    <Card id={id} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p
            // tabular-nums keeps digits the same width so the figures across the
            // metric row line up. `title` carries the full value, because a large
            // VND amount can outgrow the tile and get truncated.
            title={value ?? undefined}
            className={`mt-2 truncate text-2xl font-semibold tabular-nums ${
              value === null ? 'text-gray-400 dark:text-gray-600' : valueTone
            }`}
          >
            {value ?? '—'}
          </p>
          {sublabel && (
            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {icon}
        </div>
      </div>
    </Card>
  )
}
