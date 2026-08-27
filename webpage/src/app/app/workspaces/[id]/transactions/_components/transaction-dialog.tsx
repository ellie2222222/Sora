'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
import { formatCurrency, formatRate } from '@/lib/format'
import { useLocale } from '@/components/providers/locale-provider'
import type { Currency } from '@/schemas/currency'

/**
 * TRANSFER is excluded: it needs a second account and posts a debit/credit pair
 * through its own endpoint (TXN-US-03), so it gets its own form later.
 */
const TRANSACTION_TYPES = ['EXPENSE', 'INCOME', 'REFUND', 'INVESTMENT', 'LOAN', 'DEBT'] as const

const transactionSchema = z.object({
  accountId: z.coerce.number().int().positive('Account is required'),
  type: z.enum(TRANSACTION_TYPES),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  categoryId: z.coerce.number().int().optional(),
  description: z.string().max(500).optional(),
  // No rate field: the backend fetches and snapshots it (BR-07a).
})

type TransactionFormData = z.infer<typeof transactionSchema>

export interface AccountOption {
  id: number
  name: string
  currency: Currency
}

export interface CategoryOption {
  id: number
  name: string
  type: 'INCOME' | 'EXPENSE'
}

/** A recorded transaction as this dialog needs it for editing. */
export interface EditableTransaction {
  id: number
  account_id: number
  category_id?: number | null
  type: string
  amount: string | number
  date: string
  description?: string | null
  notes?: string | null
}

export interface TransactionDialogProps {
  workspaceId: number
  preferredCurrency: Currency
  accounts: AccountOption[]
  categories: CategoryOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /**
   * Present when editing. Amount, account, type and date are immutable once
   * recorded (BR-03) — a wrong amount is corrected by cancelling and recording a
   * replacement, so the ledger keeps both facts. They render disabled.
   */
  editing?: EditableTransaction | null
}

export function TransactionDialog({
  workspaceId,
  preferredCurrency,
  accounts,
  categories,
  open,
  onOpenChange,
  onSaved,
  editing,
}: TransactionDialogProps) {
  const { t } = useTranslate()
  const { locale } = useLocale()
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { type: 'EXPENSE', date: today },
  })

  const accountId = Number(watch('accountId'))
  const type = watch('type')
  const amount = Number(watch('amount'))

  const account = accounts.find((item) => item.id === accountId)
  const isForeign = !!account && account.currency !== preferredCurrency
  const busy = isSubmitting || submitted

  // The rate is the backend's to decide; this is only a preview of what it will
  // snapshot, read back from the same source the write will use (BR-07a).
  const [rate, setRate] = useState<number | null>(null)
  const [rateFailed, setRateFailed] = useState(false)

  useEffect(() => {
    if (!open || !isForeign || !account) {
      setRate(null)
      setRateFailed(false)
      return
    }
    let active = true
    setRateFailed(false)
    financeApiService
      .getExchangeRate(account.currency, preferredCurrency)
      .then((response) => {
        if (!active) return
        const value = Number(response.data?.rate)
        if (value > 0) setRate(value)
        else setRateFailed(true)
      })
      .catch(() => {
        if (active) setRateFailed(true)
      })
    return () => {
      active = false
    }
  }, [open, isForeign, account?.currency, preferredCurrency])

  // Only categories matching the direction of the transaction make sense.
  const categoryOptions = categories.filter((category) =>
    type === 'INCOME' || type === 'REFUND' || type === 'DEBT'
      ? category.type === 'INCOME'
      : category.type === 'EXPENSE'
  )

  useEffect(() => {
    if (open) {
      setApiError(null)
      setSubmitted(false)
      reset(
        editing
          ? {
              accountId: editing.account_id,
              type: editing.type as TransactionFormData['type'],
              amount: Number(editing.amount),
              date: editing.date.slice(0, 10),
              categoryId: editing.category_id ?? undefined,
              description: editing.description ?? '',
            }
          : { type: 'EXPENSE', date: today, accountId: accounts[0]?.id }
      )
    }
  }, [open, editing, accounts, today, reset])

  const onSubmit = async (data: TransactionFormData) => {
    try {
      setApiError(null)
      const response = editing
        ? await financeApiService.updateTransaction(workspaceId, editing.id, {
            // null clears the category; undefined would leave it untouched.
            category_id: data.categoryId || null,
            description: data.description || '',
          })
        : await financeApiService.createTransaction(workspaceId, {
            account_id: data.accountId,
            type: data.type,
            amount: data.amount,
            date: data.date,
            category_id: data.categoryId || undefined,
            description: data.description || undefined,
          })
      if (response.success) {
        setSubmitted(true)
        onSaved()
        onOpenChange(false)
      } else {
        setApiError(t('common.error'))
      }
    } catch (error: any) {
      const code = error.response?.data?.detail ?? error.response?.data?.error_code
      if (code === 'EXCHANGE_RATE_UNAVAILABLE') {
        setApiError(t('transaction.rateUnavailable'))
      } else {
        setApiError(t('common.error'))
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent id="modal-transaction">
        <DialogHeader>
          <DialogTitle>{editing ? t('transaction.edit') : t('transaction.create')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {apiError && <Alert type="error" message={apiError} />}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('transaction.account')}
              id="account-transaction"
              error={errors.accountId?.message}
            >
              <select
                id="account-transaction"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                disabled={!!editing}
                {...register('accountId')}
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.currency})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={t('transaction.type')}
              id="type-transaction"
              error={errors.type?.message}
            >
              <select
                id="type-transaction"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                disabled={!!editing}
                {...register('type')}
              >
                {TRANSACTION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`${t('transaction.amount')}${account ? ` (${account.currency})` : ''}`}
              id="amount-transaction"
              error={errors.amount?.message}
            >
              <Input
                id="amount-transaction"
                type="number"
                step="0.01"
                min="0"
                placeholder={t('transaction.amountPlaceholder')}
                error={!!errors.amount}
                disabled={!!editing}
                {...register('amount')}
              />
            </FormField>

            <FormField
              label={t('transaction.date')}
              id="date-transaction"
              error={errors.date?.message}
            >
              <Input
                id="date-transaction"
                type="date"
                error={!!errors.date}
                disabled={!!editing}
                {...register('date')}
              />
            </FormField>
          </div>

          <FormField
            label={t('transaction.category')}
            id="category-transaction"
            error={errors.categoryId?.message}
          >
            <select
              id="category-transaction"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              {...register('categoryId')}
            >
              <option value="">—</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>

          {isForeign && (
            <div
              id="rate-preview-transaction"
              className="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800/60"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('transaction.rateHint').replace('{currency}', preferredCurrency)}
              </p>
              {rateFailed ? (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {t('transaction.rateUnavailable')}
                </p>
              ) : rate == null ? (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {t('common.loading')}
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  1 {account?.currency} = {formatRate(rate, locale)} {preferredCurrency}
                  {amount > 0 && (
                    <>
                      {' · '}
                      {t('transaction.converted')}:{' '}
                      {formatCurrency(amount * rate, preferredCurrency, locale)}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <FormField
            label={t('transaction.description')}
            id="description-transaction"
            error={errors.description?.message}
          >
            <Input
              id="description-transaction"
              type="text"
              placeholder={t('transaction.descriptionPlaceholder')}
              error={!!errors.description}
              {...register('description')}
            />
          </FormField>

          {editing && (
            <p id="hint-immutable-transaction" className="text-xs text-gray-500 dark:text-gray-400">
              {t('transaction.immutableHint')}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              id="btn-cancel-transaction"
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              id="btn-submit-transaction"
              type="submit"
              variant="success"
              loading={busy}
              disabled={busy}
            >
              {editing ? t('common.save') : t('transaction.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
