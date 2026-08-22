'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Calendar,
  Pencil,
  Plus,
  StickyNote,
  Tag,
  Wallet,
  XCircle,
} from 'lucide-react'
import { AppLayout, useCurrentWorkspace } from '@/components/layouts/app-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MetaItem, MetaRow } from '@/components/ui/meta'
import { SkeletonList } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/state'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { financeApiService } from '@/lib/finance-api.service'
import { formatCurrency, formatDate, formatRate } from '@/lib/format'
import type { Currency } from '@/schemas/currency'
import {
  TransactionDialog,
  type AccountOption,
  type CategoryOption,
} from './_components/transaction-dialog'

export const dynamic = 'force-dynamic'

interface Transaction {
  id: number
  account_id: number
  account_name?: string | null
  category_name?: string | null
  type: string
  amount: string | number
  currency: Currency
  exchange_rate: string | number
  base_amount?: string | number | null
  date: string
  description?: string | null
  notes?: string | null
  status: string
}

/** Money in vs money out, matching the backend BALANCE_DIRECTION map. */
const INFLOW_TYPES = ['INCOME', 'REFUND', 'DEBT']

function TransactionsContent() {
  const workspace = useCurrentWorkspace()
  const { t } = useTranslate()
  const { locale } = useLocale()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  // The transaction awaiting cancellation confirmation.
  const [pendingCancel, setPendingCancel] = useState<Transaction | null>(null)

  const preferred = workspace.currency as Currency

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFailed(false)
      const [txnResponse, accountResponse, categoryResponse] = await Promise.all([
        financeApiService.listTransactions(workspace.id, {
          type: typeFilter || undefined,
          page_size: 50,
        }),
        financeApiService.listAccounts(workspace.id),
        financeApiService.listCategories(workspace.id),
      ])
      setTransactions(txnResponse.data?.transactions ?? [])
      setAccounts(accountResponse.data?.accounts ?? [])
      setCategories(categoryResponse.data?.categories ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [workspace.id, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  // Rejection is left to the ConfirmDialog: it keeps itself open and shows the
  // error rather than closing as though the cancellation had succeeded.
  const cancel = async () => {
    if (!pendingCancel) return
    await financeApiService.cancelTransaction(workspace.id, pendingCancel.id)
    await load()
  }

  const hasAccounts = accounts.length > 0

  /**
   * One section per calendar day, newest first, each with the day's own totals in
   * the preferred currency. Cancelled rows are listed but excluded from the
   * subtotals — their balance effect was reversed.
   */
  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>()
    for (const transaction of transactions) {
      const key = transaction.date.slice(0, 10)
      const bucket = byDate.get(key)
      if (bucket) bucket.push(transaction)
      else byDate.set(key, [transaction])
    }

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, rows]) => {
        let income = 0
        let expense = 0
        for (const row of rows) {
          if (row.status === 'cancelled') continue
          const base =
            row.base_amount != null
              ? Number(row.base_amount)
              : Number(row.amount) * Number(row.exchange_rate || 1)
          if (INFLOW_TYPES.includes(row.type)) income += base
          else if (row.type !== 'TRANSFER') expense += base
        }
        const relative =
          date === today
            ? t('common.today')
            : date === yesterday
              ? t('common.yesterday')
              : null
        return {
          date,
          label: relative
            ? `${relative} · ${formatDate(date, locale)}`
            : formatDate(date, locale),
          income,
          expense,
          transactions: rows,
        }
      })
  }, [transactions, locale, t])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('transaction.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('transaction.subtitle')}</p>
        </div>
        <Button
          id="btn-add-transaction"
          variant="success"
          disabled={!hasAccounts}
          title={hasAccounts ? undefined : t('transaction.needsAccount')}
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t('transaction.create')}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader title={t('transaction.title')} />
          <CardContent>
            <SkeletonList id="skeleton-transactions" rows={6} />
          </CardContent>
        </Card>
      ) : failed ? (
        <ErrorState message={t('common.error')} onRetry={load} retryLabel={t('common.back')} />
      ) : !hasAccounts ? (
        <Card>
          <EmptyState
            id="empty-transactions-no-account"
            icon={<ArrowLeftRight className="h-5 w-5" />}
            title={t('transaction.empty')}
            hint={t('transaction.needsAccount')}
            action={
              <Link href={`/app/workspaces/${workspace.id}/accounts`}>
                <Button id="btn-goto-accounts" variant="secondary">
                  {t('account.create')}
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${t('transaction.title')} (${transactions.length})`}
            action={
              <select
                id="search-type"
                aria-label={t('transaction.type')}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              >
                <option value="">{t('transaction.filterAll')}</option>
                {['EXPENSE', 'INCOME', 'TRANSFER', 'REFUND', 'INVESTMENT', 'LOAN', 'DEBT'].map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                )}
              </select>
            }
          />
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState
                id="empty-transactions"
                icon={<ArrowLeftRight className="h-5 w-5" />}
                title={t('transaction.empty')}
                hint={t('transaction.emptyHint')}
              />
            ) : (
              <div id="table-transactions" className="space-y-5">
                {groups.map((group) => (
                  <section key={group.date} id={`section-transactions-${group.date}`}>
                    {/* One header per day, so a scroll through the list reads as
                        days rather than one undifferentiated column of rows.
                        Sticky: the day you are reading stays named as you scroll. */}
                    <div className="sticky top-0 z-10 -mx-5 flex items-baseline justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-2 backdrop-blur dark:border-gray-800 dark:bg-slate-900/95">
                      <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {group.label}
                      </h3>
                      <p className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {group.income > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            +{formatCurrency(group.income, preferred, locale)}
                          </span>
                        )}
                        {group.income > 0 && group.expense > 0 && ' · '}
                        {group.expense > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            −{formatCurrency(group.expense, preferred, locale)}
                          </span>
                        )}
                      </p>
                    </div>

                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                      {group.transactions.map((transaction) => {
                  const isInflow = INFLOW_TYPES.includes(transaction.type)
                  const isForeign = transaction.currency !== preferred
                  const converted =
                    transaction.base_amount != null
                      ? Number(transaction.base_amount)
                      : Number(transaction.amount) * Number(transaction.exchange_rate || 1)
                  const cancelled = transaction.status === 'cancelled'

                  return (
                    <li
  key={transaction.id}
  className={`flex items-start justify-between gap-4 py-4 ${
    cancelled ? 'opacity-60' : ''
  }`}
>
  <div className="min-w-0 flex-1">
    {/* What kind of movement this is leads the row: the category and type are
        what a reader scans for. The description is the row's own detail and
        sits below, so neither can be mistaken for the other. */}
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
        title={t('transaction.category')}
      >
        {transaction.category_name || t('transaction.uncategorized')}
      </span>
      <Badge tone={isInflow ? 'income' : 'expense'} icon={<Tag className="h-3 w-3" />}>
        {transaction.type}
      </Badge>
      {cancelled && <Badge tone="danger">{t('transaction.cancelled')}</Badge>}
    </div>

    {transaction.description && (
      <p
        className="mt-1 truncate text-xs text-gray-600 dark:text-gray-300"
        title={t('transaction.description')}
      >
        {transaction.description}
      </p>
    )}

    <MetaRow>
      <MetaItem icon={<Calendar />} label={t('transaction.date')}>
        {formatDate(transaction.date, locale)}
      </MetaItem>
      <MetaItem icon={<Wallet />} label={t('transaction.account')}>
        {transaction.account_name || '—'}
      </MetaItem>
      {transaction.notes && (
        <MetaItem icon={<StickyNote />} label={t('transaction.notes')} className="italic">
          {transaction.notes}
        </MetaItem>
      )}
    </MetaRow>
  </div>

  <div className="flex items-start gap-3 shrink-0">
    <div className="text-right tabular-nums">
      <p
        className={`text-base font-semibold ${
          isInflow
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-900 dark:text-gray-100'
        } ${cancelled ? 'line-through' : ''}`}
      >
        {isInflow ? '+' : '−'}
        {formatCurrency(Number(transaction.amount), transaction.currency, locale)}
      </p>

      {isForeign && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          ≈ {formatCurrency(converted, preferred, locale)}
        </p>
      )}
    </div>

    {!cancelled && (
      <button
        id={`btn-edit-transaction-${transaction.id}`}
        type="button"
        aria-label={t('transaction.edit')}
        title={t('transaction.edit')}
        onClick={() => {
          setEditing(transaction)
          setDialogOpen(true)
        }}
        className="mt-0.5 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Pencil className="h-4 w-4" />
      </button>
    )}

    {!cancelled && (
      <button
        id={`btn-cancel-transaction-${transaction.id}`}
        type="button"
        aria-label={t('transaction.cancel')}
        title={t('transaction.cancel')}
        onClick={() => setPendingCancel(transaction)}
        className="mt-0.5 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <XCircle className="h-4 w-4" />
      </button>
    )}
  </div>
</li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TransactionDialog
        workspaceId={workspace.id}
        preferredCurrency={preferred}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        editing={editing}
      />

      <ConfirmDialog
        id="modal-confirm-cancel-transaction"
        variant="destructive"
        open={pendingCancel !== null}
        onOpenChange={(next) => !next && setPendingCancel(null)}
        title={t('transaction.cancel')}
        description={t('transaction.confirmCancel')}
        detail={
          pendingCancel && (
            <span className="tabular-nums">
              {formatDate(pendingCancel.date, locale)} ·{' '}
              {formatCurrency(
                Number(pendingCancel.amount),
                pendingCancel.currency,
                locale
              )}
              {pendingCancel.description ? ` · ${pendingCancel.description}` : ''}
            </span>
          )
        }
        confirmLabel={t('transaction.cancel')}
        cancelLabel={t('common.back')}
        errorMessage={t('common.error')}
        onConfirm={cancel}
      />
    </div>
  )
}

export default function TransactionsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout
      workspaceId={workspaceId}
      activeKey="transactions"
      breadcrumb={t('nav.transactions')}
    >
      <TransactionsContent />
    </AppLayout>
  )
}
