'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiClient } from '@/lib/api-client'
import { CURRENCIES } from '@/schemas/currency'
import { createWorkspaceSchema, CreateWorkspaceFormData } from '@/schemas/workspace'
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

export interface CreateWorkspaceDialogProps {
  /** Controls dialog visibility. */
  open: boolean
  /** Called when the dialog requests to open or close (overlay click, Esc, cancel). */
  onOpenChange: (open: boolean) => void
  /** Called with the new workspace id after a successful create. */
  onCreated: (workspaceId: number) => void
}

/**
 * Create Workspace form in a modal. Shared by the workspace chooser and the
 * workspace switcher in the app layout so neither has to navigate away.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const { t } = useTranslate()
  const [apiError, setApiError] = useState<string | null>(null)
  // isSubmitting drops as soon as the request resolves, but the caller still has
  // to navigate. This latch keeps the form busy until then so the workspace
  // cannot be created twice by an impatient second click.
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      currency: 'USD',
    },
  })

  // Each opening starts from a clean form; a stale error or half-typed name from
  // the previous attempt would otherwise be waiting there.
  useEffect(() => {
    if (open) {
      setApiError(null)
      setSubmitted(false)
      reset({ currency: 'USD' })
    }
  }, [open, reset])

  const busy = isSubmitting || submitted

  const onSubmit = async (data: CreateWorkspaceFormData) => {
    try {
      setApiError(null)
      const response = await apiClient.createWorkspace(
        data.name,
        data.description,
        data.currency
      )

      if (response.success) {
        setSubmitted(true)
        onCreated(response.data.id)
      } else {
        setApiError(t('common.error'))
      }
    } catch (error: any) {
      setApiError(t('common.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent id="modal-workspace">
        <DialogHeader>
          <DialogTitle>{t('workspace.createWorkspace')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {apiError && <Alert type="error" message={apiError} />}

          <FormField
            label={t('workspace.workspaceName')}
            id="name-workspace"
            error={errors.name?.message}
          >
            <Input
              id="name-workspace"
              type="text"
              placeholder={t('workspace.namePlaceholder')}
              error={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField
            label={t('workspace.description')}
            id="description-workspace"
            error={errors.description?.message}
          >
            <textarea
              id="description-workspace"
              rows={3}
              placeholder={t('workspace.descriptionPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500"
              {...register('description')}
            />
          </FormField>

          <FormField
            label={t('workspace.preferredCurrency')}
            id="currency-workspace"
            error={errors.currency?.message}
          >
            <select
              id="currency-workspace"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              {...register('currency')}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('workspace.preferredCurrencyHint')}
            </p>
          </FormField>

          <DialogFooter className="pt-2">
            <Button
              id="btn-cancel-workspace"
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              id="btn-submit-workspace"
              type="submit"
              variant="success"
              loading={busy}
              disabled={busy}
            >
              {t('workspace.createWorkspace')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
