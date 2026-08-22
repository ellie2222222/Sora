'use client'

import React from 'react'
import { ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency } from '@/lib/format'
import type { FlowStats } from '@/types/dashboard'

export interface FlowStatsCardProps {
  id: string
  title: string
  /** Which slice of time this covers, e.g. the month name or "Today". */
  sublabel?: string
  stats: FlowStats
  currency: string
}

/**
 * Income, expense and net side by side for one period.
 *
 * The three always appear together: an income figure alone says nothing about
 * whether the period was solvent, and net alone hides which side moved.
 */
export const FlowStatsCard: React.FC<FlowStatsCardProps> = ({
  id,
  title,
  sublabel,
  stats,
  currency,
}) => {
  const { t } = useTranslate()
  const { locale } = useLocale()

  const money = (value: number) => formatCurrency(value, currency, locale)
  const positiveNet = stats.net >= 0

  return (
    <Card id={id}>
      <CardHeader title={title} description={sublabel} />
      <CardContent className="grid grid-cols-3 gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ArrowUpRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            {t('dashboard.income')}
          </p>
          <p
            id={`${id}-income`}
            className="mt-1 truncate text-sm font-semibold tabular-nums text-green-600 dark:text-green-400"
            title={money(stats.income)}
          >
            {money(stats.income)}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            {t('dashboard.expense')}
          </p>
          <p
            id={`${id}-expense`}
            className="mt-1 truncate text-sm font-semibold tabular-nums text-red-600 dark:text-red-400"
            title={money(stats.expense)}
          >
            {money(stats.expense)}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Equal className="h-3.5 w-3.5" />
            {t('dashboard.net')}
          </p>
          <p
            id={`${id}-net`}
            className={`mt-1 truncate text-sm font-semibold tabular-nums ${
              positiveNet
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-red-600 dark:text-red-400'
            }`}
            title={money(stats.net)}
          >
            {money(stats.net)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
