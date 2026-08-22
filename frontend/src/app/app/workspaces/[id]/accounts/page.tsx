'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Archive, Building2, Hash, Landmark, Pencil, Plus, Wallet } from 'lucide-react'
import { AppLayout, useCurrentWorkspace } from '@/components/layouts/app-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MetaItem, MetaRow } from '@/components/ui/meta'
import { Skeleton, SkeletonList } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/state'
import { useLocale } from '@/components/providers/locale-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { financeApiService } from '@/lib/finance-api.service'
import { formatCurrency } from '@/lib/format'
import type { Currency } from '@/schemas/currency'
import { AccountDialog } from './_components/account-dialog'

export const dynamic = 'force-dynamic'

interface Account {
  id: number
  type: string
  name: string
  currency: Currency
  balance: string | number
  opening_balance: string | number
  exchange_rate: string | number
  institution?: string | null
  /** Masked by the backend — last 4 digits only. */
  account_number?: string | null
  status: string
}

function AccountsContent() {
  const workspace = useCurrentWorkspace()
  const { t } = useTranslate()
  const { locale } = useLocale()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  // The account awaiting archive confirmation.
  const [pendingArchive, setPendingArchive] = useState<Account | null>(null)

  const preferred = workspace.currency as Currency

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFailed(false)
      const response = await financeApiService.listAccounts(workspace.id)
      setAccounts(response.data?.accounts ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [workspace.id])

  useEffect(() => {
    load()
  }, [load])

  // Rejection is the ConfirmDialog's to report — an account that could not be
  // archived (ACCOUNT_HAS_PENDING_TRANSACTIONS) must not look archived.
  const archive = async () => {
    if (!pendingArchive) return
    await financeApiService.archiveAccount(workspace.id, pendingArchive.id)
    await load()
  }

  // Total is stated in the preferred currency: each account's balance is converted
  // with the rate snapshotted when the account was opened (BR-07a).
  const totalInPreferred = accounts
    .filter((account) => account.status !== 'archived')
    .reduce(
      (sum, account) => sum + Number(account.balance) * Number(account.exchange_rate || 1),
      0
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('account.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('account.subtitle')}</p>
        </div>
        <Button
          id="btn-add-account"
          variant="success"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t('account.create')}
        </Button>
      </div>

      {loading ? (
        <>
          <Card>
            <CardContent className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t('account.title')} />
            <CardContent>
              <SkeletonList id="skeleton-accounts" rows={4} />
            </CardContent>
          </Card>
        </>
      ) : failed ? (
        <ErrorState message={t('common.error')} onRetry={load} retryLabel={t('common.back')} />
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            id="empty-accounts"
            icon={<Wallet className="h-5 w-5" />}
            title={t('account.empty')}
            hint={t('account.emptyHint')}
            action={
              <Button
                id="btn-create-first-account"
                variant="success"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t('account.create')}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('account.totalBalance')}
              </span>
              <span
                id="total-balance-accounts"
                className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white"
              >
                {formatCurrency(totalInPreferred, preferred, locale)}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={`${t('account.title')} (${accounts.length})`} />
            <CardContent>
              <ul id="table-accounts" className="divide-y divide-gray-100 dark:divide-gray-800">
                {accounts.map((account) => {
                  const rate = Number(account.exchange_rate || 1)
                  const isForeign = account.currency !== preferred
                  return (
                    <li
                      key={account.id}
                      className={`flex items-start justify-between gap-4 py-4 ${
                        account.status === 'archived' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {/* Name is the only field in strong type; everything else
                            is a labelled meta item or a badge, so the name can
                            never be confused with the type or the institution. */}
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {account.name}
                        </p>

                        <MetaRow>
                          <Badge tone="neutral" icon={<Landmark className="h-3 w-3" />}>
                            {account.type.replace(/_/g, ' ')}
                          </Badge>
                          <Badge tone="muted">{account.currency}</Badge>
                          {account.institution && (
                            <MetaItem icon={<Building2 />} label={t('account.institution')}>
                              {account.institution}
                            </MetaItem>
                          )}
                          {account.account_number && (
                            <MetaItem
                              icon={<Hash />}
                              label={t('account.accountNumber')}
                              className="tabular-nums"
                            >
                              {account.account_number}
                            </MetaItem>
                          )}
                          {account.status === 'archived' && (
                            <Badge tone="danger">{t('account.archived')}</Badge>
                          )}
                        </MetaRow>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(Number(account.balance), account.currency, locale)}
                        </p>
                        {isForeign && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            ≈ {formatCurrency(Number(account.balance) * rate, preferred, locale)}
                          </p>
                        )}
                      </div>
                      {account.status !== 'archived' && (
                        <button
                          id={`btn-edit-account-${account.id}`}
                          type="button"
                          aria-label={t('account.edit')}
                          title={t('account.edit')}
                          onClick={() => {
                            setEditing(account)
                            setDialogOpen(true)
                          }}
                          className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {account.status !== 'archived' && (
                        <button
                          id={`btn-archive-account-${account.id}`}
                          type="button"
                          aria-label={t('account.archive')}
                          title={t('account.archive')}
                          onClick={() => setPendingArchive(account)}
                          className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <AccountDialog
        workspaceId={workspace.id}
        preferredCurrency={preferred}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        editing={editing}
      />

      <ConfirmDialog
        id="modal-confirm-archive-account"
        variant="warning"
        open={pendingArchive !== null}
        onOpenChange={(next) => !next && setPendingArchive(null)}
        title={t('account.archive')}
        description={t('account.confirmArchive')}
        detail={
          pendingArchive && (
            <span>
              {pendingArchive.name} ·{' '}
              <span className="tabular-nums">
                {formatCurrency(
                  Number(pendingArchive.balance),
                  pendingArchive.currency,
                  locale
                )}
              </span>
            </span>
          )
        }
        confirmLabel={t('account.archive')}
        cancelLabel={t('common.back')}
        errorMessage={t('account.archiveFailed')}
        onConfirm={archive}
      />
    </div>
  )
}

export default function AccountsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout workspaceId={workspaceId} activeKey="accounts" breadcrumb={t('nav.accounts')}>
      <AccountsContent />
    </AppLayout>
  )
}
