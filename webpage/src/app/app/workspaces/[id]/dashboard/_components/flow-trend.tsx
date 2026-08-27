'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency } from '@/lib/format'
import type { FlowPoint } from '@/types/dashboard'

export interface FlowTrendProps {
  monthly: FlowPoint[]
  daily: FlowPoint[]
  currency: string
}

type Grain = 'monthly' | 'daily'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', vi: 'vi-VN' }

/**
 * Income against expense over time.
 *
 * Drawn with plain divs rather than a charting library: two bars per period is
 * not worth a dependency, and the constitution asks for the smaller option
 * (Simplicity Over Premature Scale).
 */
export const FlowTrend: React.FC<FlowTrendProps> = ({ monthly, daily, currency }) => {
  const { t } = useTranslate()
  const { locale } = useLocale()
  const [grain, setGrain] = useState<Grain>('monthly')

  const points = grain === 'monthly' ? monthly : daily
  // Bars are scaled against the largest single figure on show, so the tallest
  // bar always fills the plot and small periods stay visible.
  const peak = Math.max(1, ...points.map((point) => Math.max(point.income, point.expense)))

  const label = (period: string) => {
    const date = new Date(period)
    const tag = LOCALE_TAGS[locale] ?? 'en-US'
    return grain === 'monthly'
      ? new Intl.DateTimeFormat(tag, { month: 'short' }).format(date)
      : new Intl.DateTimeFormat(tag, { day: 'numeric' }).format(date)
  }

  const money = (value: number) => formatCurrency(value, currency, locale)

  return (
    <Card>
      <CardHeader
        title={t('dashboard.trend')}
        description={
          grain === 'monthly' ? t('dashboard.trendMonthly') : t('dashboard.trendDaily')
        }
        action={
          <div
            role="tablist"
            aria-label={t('dashboard.trend')}
            className="flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-700"
          >
            {(['monthly', 'daily'] as Grain[]).map((option) => (
              <button
                key={option}
                id={`btn-trend-${option}`}
                type="button"
                role="tab"
                aria-selected={grain === option}
                onClick={() => setGrain(option)}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  grain === option
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {t(`dashboard.grain.${option}`)}
              </button>
            ))}
          </div>
        }
      />
      <CardContent>
        <div className="mb-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-green-500" aria-hidden="true" />
            {t('dashboard.income')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-500" aria-hidden="true" />
            {t('dashboard.expense')}
          </span>
        </div>

        <div
          id={`chart-flow-${grain}`}
          className="flex h-40 items-end gap-1 overflow-x-auto pb-1"
        >
          {points.map((point) => (
            <div
              key={point.period}
              className="flex min-w-0 flex-1 shrink-0 basis-4 flex-col items-center gap-1"
              // Native tooltip carries the exact figures — the bars give shape,
              // not precision.
              title={`${point.period}\n${t('dashboard.income')}: ${money(point.income)}\n${t(
                'dashboard.expense'
              )}: ${money(point.expense)}\n${t('dashboard.net')}: ${money(point.net)}`}
            >
              <div className="flex h-32 w-full items-end justify-center gap-[2px]">
                <div
                  className="w-1/2 max-w-[10px] rounded-t bg-green-500/80 dark:bg-green-500/70"
                  style={{ height: `${(point.income / peak) * 100}%` }}
                />
                <div
                  className="w-1/2 max-w-[10px] rounded-t bg-red-500/80 dark:bg-red-500/70"
                  style={{ height: `${(point.expense / peak) * 100}%` }}
                />
              </div>
              <span className="truncate text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                {label(point.period)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
