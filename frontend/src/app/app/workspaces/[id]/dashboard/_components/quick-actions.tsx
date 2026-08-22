'use client'

import React from 'react'
import { Plus, PiggyBank, Target } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useTranslate } from '@/hooks/useTranslate'

/**
 * Quick actions from SDS §3.2. Each stays disabled until its create form
 * and backing endpoint exist, so the dashboard never links to a dead route.
 */
export const QuickActions: React.FC = () => {
  const { t } = useTranslate()

  const actions = [
    { key: 'transaction', labelKey: 'dashboard.addTransaction', icon: <Plus className="h-4 w-4" /> },
    { key: 'budget', labelKey: 'dashboard.createBudget', icon: <PiggyBank className="h-4 w-4" /> },
    { key: 'goal', labelKey: 'dashboard.createGoal', icon: <Target className="h-4 w-4" /> },
  ]

  return (
    <Card>
      <CardHeader title={t('dashboard.quickActions')} />
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        {actions.map((action) => (
          <button
            key={action.key}
            id={`btn-add-${action.key}`}
            type="button"
            disabled
            title={`${t(action.labelKey)} — ${t('nav.comingSoon')}`}
            className="flex min-h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-600"
          >
            {action.icon}
            <span>{t(action.labelKey)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
