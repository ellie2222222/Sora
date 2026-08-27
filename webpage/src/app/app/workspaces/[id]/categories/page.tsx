'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Archive, Pencil, Plus, Tags } from 'lucide-react'
import { AppLayout, useCurrentWorkspace } from '@/components/layouts/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SkeletonList } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/state'
import { useTranslate } from '@/hooks/useTranslate'
import { financeApiService } from '@/lib/finance-api.service'
import { CategoryDialog } from './_components/category-dialog'

export const dynamic = 'force-dynamic'

interface Category {
  id: number
  name: string
  type: 'INCOME' | 'EXPENSE'
  is_default: boolean
  is_archived: boolean
}

function CategoriesContent() {
  const workspace = useCurrentWorkspace()
  const { t } = useTranslate()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  // The category awaiting archive confirmation.
  const [pendingArchive, setPendingArchive] = useState<Category | null>(null)

  const isOwner = workspace.user_role === 'OWNER'

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFailed(false)
      const response = await financeApiService.listCategories(workspace.id)
      setCategories(response.data?.categories ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [workspace.id])

  useEffect(() => {
    load()
  }, [load])

  // Rejection is the ConfirmDialog's to report: a category in use comes back as
  // CATEGORY_IN_USE and stays exactly as it was.
  const archive = async () => {
    if (!pendingArchive) return
    await financeApiService.archiveCategory(workspace.id, pendingArchive.id)
    await load()
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const groups: { type: 'INCOME' | 'EXPENSE'; labelKey: string }[] = [
    { type: 'INCOME', labelKey: 'category.income' },
    { type: 'EXPENSE', labelKey: 'category.expense' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('category.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('category.subtitle')}</p>
        </div>
        {isOwner && (
          <Button id="btn-add-category" variant="success" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('category.create')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {['income', 'expense'].map((group) => (
            <Card key={group}>
              <CardHeader title={t(`category.${group}`)} />
              <CardContent>
                <SkeletonList id={`skeleton-categories-${group}`} rows={4} withValue={false} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : failed ? (
        <ErrorState message={t('common.error')} onRetry={load} retryLabel={t('common.back')} />
      ) : categories.length === 0 ? (
        <Card>
          <EmptyState
            id="empty-categories"
            icon={<Tags className="h-5 w-5" />}
            title={t('category.empty')}
            hint={t('category.emptyHint')}
            action={
              isOwner ? (
                <Button id="btn-create-first-category" variant="success" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  {t('category.create')}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map((group) => {
            const rows = categories.filter((category) => category.type === group.type)
            return (
              <Card key={group.type}>
                <CardHeader title={`${t(group.labelKey)} (${rows.length})`} />
                <CardContent>
                  <ul id={`table-categories-${group.type.toLowerCase()}`} className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((category) => (
                      <li
                        key={category.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {category.name}
                          </p>
                          <div className="mt-0.5 flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {category.is_default && <span>{t('category.default')}</span>}
                            {category.is_archived && <span>{t('category.archived')}</span>}
                          </div>
                        </div>
                        {isOwner && !category.is_archived && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              id={`btn-edit-category-${category.id}`}
                              type="button"
                              aria-label={t('category.edit')}
                              title={t('category.edit')}
                              onClick={() => {
                                setEditing(category)
                                setDialogOpen(true)
                              }}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              id={`btn-archive-category-${category.id}`}
                              type="button"
                              aria-label={t('category.archive')}
                              title={t('category.archive')}
                              onClick={() => setPendingArchive(category)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                    {rows.length === 0 && (
                      <li className="py-3 text-sm text-gray-500 dark:text-gray-400">
                        {t('category.empty')}
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CategoryDialog
        workspaceId={workspace.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        editing={editing}
      />

      <ConfirmDialog
        id="modal-confirm-archive-category"
        variant="warning"
        open={pendingArchive !== null}
        onOpenChange={(next) => !next && setPendingArchive(null)}
        title={t('category.archive')}
        description={t('category.confirmArchive')}
        detail={pendingArchive?.name}
        confirmLabel={t('category.archive')}
        cancelLabel={t('common.back')}
        errorMessage={t('category.archiveFailed')}
        onConfirm={archive}
      />
    </div>
  )
}

export default function CategoriesPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout workspaceId={workspaceId} activeKey="categories" breadcrumb={t('nav.categories')}>
      <CategoriesContent />
    </AppLayout>
  )
}
