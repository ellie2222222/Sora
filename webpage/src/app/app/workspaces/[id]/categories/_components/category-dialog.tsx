'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { financeApiService } from '@/lib/finance-api.service'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField, Input } from '@/components/ui/form-field'
import { useTranslate } from '@/hooks/useTranslate'

const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const

/** Mirrors CreateCategoryRequest in the backend schemas (FE-02). */
const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  type: z.enum(CATEGORY_TYPES),
})

type CategoryFormData = z.infer<typeof categorySchema>

export interface CategoryDialogProps {
  workspaceId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Refetch trigger for the caller once the write succeeds. */
  onSaved: () => void
  /** Present when editing; only the name is editable server-side. */
  editing?: { id: number; name: string; type: 'INCOME' | 'EXPENSE' } | null
}

export function CategoryDialog({
  workspaceId,
  open,
  onOpenChange,
  onSaved,
  editing,
}: CategoryDialogProps) {
  const { t } = useTranslate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { type: 'EXPENSE' },
  })

  useEffect(() => {
    if (open) {
      setApiError(null)
      setSubmitted(false)
      reset(
        editing
          ? { name: editing.name, type: editing.type }
          : { name: '', type: 'EXPENSE' }
      )
    }
  }, [open, editing, reset])

  const busy = isSubmitting || submitted

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setApiError(null)
      const response = editing
        ? await financeApiService.updateCategory(workspaceId, editing.id, { name: data.name })
        : await financeApiService.createCategory(workspaceId, data)

      if (response.success) {
        setSubmitted(true)
        onSaved()
        onOpenChange(false)
      } else {
        setApiError(t('common.error'))
      }
    } catch (error: any) {
      const code = error.response?.data?.detail ?? error.response?.data?.error_code
      if (code === 'CATEGORY_NAME_EXISTS') setApiError(t('category.nameExists'))
      else if (code === 'PERMISSION_DENIED') setApiError(t('category.ownerOnly'))
      else setApiError(t('common.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent id="modal-category">
        <DialogHeader>
          <DialogTitle>{editing ? t('category.edit') : t('category.create')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {apiError && <Alert type="error" message={apiError} />}

          <FormField label={t('category.name')} id="name-category" error={errors.name?.message}>
            <Input
              id="name-category"
              type="text"
              placeholder={t('category.namePlaceholder')}
              error={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField label={t('category.type')} id="type-category" error={errors.type?.message}>
            <select
              id="type-category"
              // The backend treats type as immutable once the category exists.
              disabled={!!editing}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              {...register('type')}
            >
              <option value="EXPENSE">{t('category.expense')}</option>
              <option value="INCOME">{t('category.income')}</option>
            </select>
          </FormField>

          <DialogFooter className="pt-2">
            <Button
              id="btn-cancel-category"
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              id="btn-submit-category"
              type="submit"
              variant="success"
              loading={busy}
              disabled={busy}
            >
              {editing ? t('common.save') : t('category.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
