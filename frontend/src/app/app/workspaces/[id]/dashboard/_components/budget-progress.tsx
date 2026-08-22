'use client'

import React from 'react'
import { PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency } from '@/lib/format'
import { BudgetProgressItem } from '@/types/dashboard'

interface BudgetProgressPanelProps {
  budgets: BudgetProgressItem[]
  currency: string
}

export const BudgetProgressPanel: React.FC<BudgetProgressPanelProps> = ({
  budgets,
  currency,
}) => {
  const { t } = useTranslate()
  const { locale } = useLocale()

  return (
    <Card>
      <CardHeader title={t('dashboard.budgetProgress')} description={t('dashboard.thisMonth')} />
      {budgets.length === 0 ? (
        <EmptyState
          id="empty-budgets"
          icon={<PiggyBank className="h-5 w-5" />}
          title={t('dashboard.noBudgets')}
          hint={t('dashboard.noBudgetsHint')}
        />
      ) : (
        <CardContent className="space-y-5">
          {budgets.map((budget) => {
            // A zero allocation would divide by zero; treat any spend against it as fully consumed.
            const percent =
              budget.allocated > 0
                ? (budget.spent / budget.allocated) * 100
                : budget.spent > 0
                  ? 100
                  : 0
            const remaining = budget.allocated - budget.spent
            const tone = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : 'default'
            const label = budget.category ? `${budget.name} · ${budget.category}` : budget.name

            return (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {label}
                  </p>
                  <p className="shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                    {formatCurrency(budget.spent, currency, locale)} /{' '}
                    {formatCurrency(budget.allocated, currency, locale)}
                  </p>
                </div>
                <Progress
                  id={`progress-budget-${budget.id}`}
                  value={percent}
                  tone={tone}
                  label={`${label} — ${Math.round(percent)}%`}
                />
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {remaining >= 0
                    ? `${t('dashboard.remaining')}: ${formatCurrency(remaining, currency, locale)}`
                    : `${t('dashboard.overBudget')}: ${formatCurrency(Math.abs(remaining), currency, locale)}`}
                </p>
              </div>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}
