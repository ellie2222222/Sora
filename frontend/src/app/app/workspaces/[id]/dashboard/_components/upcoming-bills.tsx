'use client'

import React from 'react'
import { Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency, formatDate } from '@/lib/format'
import { UpcomingBill } from '@/types/dashboard'

interface UpcomingBillsProps {
  bills: UpcomingBill[]
  currency: string
}

export const UpcomingBills: React.FC<UpcomingBillsProps> = ({ bills, currency }) => {
  const { t } = useTranslate()
  const { locale } = useLocale()

  const rows = [...bills].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  return (
    <Card>
      <CardHeader title={t('dashboard.upcomingBills')} description={t('dashboard.next7Days')} />
      {rows.length === 0 ? (
        <EmptyState
          id="empty-bills"
          icon={<Receipt className="h-5 w-5" />}
          title={t('dashboard.noBills')}
          hint={t('dashboard.noBillsHint')}
        />
      ) : (
        <CardContent className="divide-y divide-gray-100 px-0 py-0 dark:divide-gray-800">
          {rows.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {bill.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.colDueDate')}: {formatDate(bill.dueDate, locale)}
                  {bill.category ? ` · ${bill.category}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(bill.amount, currency, locale)}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
