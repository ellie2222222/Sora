'use client'

import React from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency, formatDate } from '@/lib/format'
import { RecentTransaction } from '@/types/dashboard'

interface RecentTransactionsProps {
  transactions: RecentTransaction[]
  currency: string
}

/** Money leaving the workspace is shown as a negative amount. */
const OUTFLOW_TYPES = ['EXPENSE', 'LOAN', 'INVESTMENT']

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  currency,
}) => {
  const { t } = useTranslate()
  const { locale } = useLocale()

  // SDS §3.2: last 10 rows, most recent first.
  const rows = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)

  return (
    <Card>
      <CardHeader title={t('dashboard.recentTransactions')} />
      {rows.length === 0 ? (
        <EmptyState
          id="empty-transactions"
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title={t('dashboard.noTransactions')}
          hint={t('dashboard.noTransactionsHint')}
        />
      ) : (
        <CardContent className="overflow-x-auto px-0 py-0">
          <table id="table-transactions" className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">{t('dashboard.colDate')}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t('dashboard.colCategory')}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t('dashboard.colAccount')}</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t('dashboard.colAmount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => {
                const isOutflow = OUTFLOW_TYPES.includes(row.type)
                const signed = isOutflow ? -Math.abs(row.amount) : Math.abs(row.amount)

                return (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatDate(row.date, locale)}
                    </td>
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">
                      {row.category || row.description || row.type}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.account || '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${
                        isOutflow
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {formatCurrency(signed, currency, locale)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  )
}
