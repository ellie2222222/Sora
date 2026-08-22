'use client'

import React from 'react'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency } from '@/lib/format'
import type { AccountStats } from '@/types/dashboard'

export interface AccountBreakdownProps {
  accounts: AccountStats[]
  /** Workspace preferred currency — what the income, expense and net columns use. */
  currency: string
  workspaceId: number
}

/**
 * Where the money sits and how each account moved.
 *
 * Balance is shown in the account's own currency (that is the figure a user can
 * check against their bank), while income, expense and net are in the workspace
 * preferred currency so the columns can be compared and totalled (BR-07a).
 */
export const AccountBreakdown: React.FC<AccountBreakdownProps> = ({
  accounts,
  currency,
  workspaceId,
}) => {
  const { t } = useTranslate()
  const { locale } = useLocale()

  const preferred = (value: number) => formatCurrency(value, currency, locale)

  return (
    <Card>
      <CardHeader
        title={t('dashboard.byAccount')}
        description={t('dashboard.byAccountHint')}
        action={
          <Link
            id="link-all-accounts"
            href={`/app/workspaces/${workspaceId}/accounts`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('nav.accounts')}
          </Link>
        }
      />
      {accounts.length === 0 ? (
        <EmptyState
          id="empty-account-breakdown"
          icon={<Wallet className="h-5 w-5" />}
          title={t('account.empty')}
          hint={t('account.emptyHint')}
        />
      ) : (
        <CardContent className="overflow-x-auto px-0 py-0">
          <table id="table-account-breakdown" className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  {t('account.name')}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t('account.balance')}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t('dashboard.income')}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t('dashboard.expense')}
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  {t('dashboard.net')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  id={`row-account-${account.id}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {account.name}
                      </span>
                      <Badge tone="muted">{account.currency}</Badge>
                      {account.status === 'archived' && (
                        <Badge tone="danger">{t('account.archived')}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {account.type.replace(/_/g, ' ')}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(account.balance, account.currency, locale)}
                    {account.currency !== currency && (
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        ≈ {preferred(account.baseBalance)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                    {preferred(account.income)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                    {preferred(account.expense)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${
                      account.net >= 0
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {preferred(account.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  )
}
