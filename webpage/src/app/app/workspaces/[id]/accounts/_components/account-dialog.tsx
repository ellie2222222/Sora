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
import { CURRENCIES, Currency, currencySchema } from '@/schemas/currency'

/** ACC-US-01 account types; mirrors the backend AccountType enum (FE-02). */
const ACCOUNT_TYPES = [
  'CASH',
  'BANK_ACCOUNT',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'SAVINGS',
  'INVESTMENT',
  'CRYPTO',
  'DIGITAL_WALLET',
] as const

const accountSchema = z.object({
  type: z.enum(ACCOUNT_TYPES),
  name: z.string().min(1, 'Account name is required').max(255),
  currency: currencySchema,
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative'),
  institution: z.string().max(255).optional(),
  accountNumber: z.string().max(255).optional(),
  // No rate field: the backend fetches and snapshots it (BR-07a).
})

type AccountFormData = z.infer<typeof accountSchema>

/** The subset of an account this dialog can edit, plus the fields it shows read-only. */
export interface EditableAccount {
  id: number
  name: string
  type: string
  currency: Currency
  institution?: string | null
  account_number?: string | null
}

export interface AccountDialogProps {
  workspaceId: number
  /** Workspace preferred currency — decides whether a rate note is shown. */
  preferredCurrency: Currency
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /**
   * Present when editing. Type, currency and opening balance are immutable
   * afterwards (ACC-US-03), so they render disabled rather than being hidden —
   * a user needs to see what the account is, just not change it.
   */
  editing?: EditableAccount | null
}

export function AccountDialog({
  workspaceId,
  preferredCurrency,
  open,
  onOpenChange,
  onSaved,
  editing,
}: AccountDialogProps) {
  const { t } = useTranslate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { type: 'BANK_ACCOUNT', currency: preferredCurrency, openingBalance: 0 },
  })

  const selectedCurrency = watch('currency')
  const isForeign = selectedCurrency !== preferredCurrency
  const busy = isSubmitting || submitted

  useEffect(() => {
    if (open) {
      setApiError(null)
      setSubmitted(false)
      reset(
        editing
          ? {
              type: editing.type as AccountFormData['type'],
              name: editing.name,
              currency: editing.currency,
              openingBalance: 0,
              institution: editing.institution ?? '',
              accountNumber: editing.account_number ?? '',
            }
          : { type: 'BANK_ACCOUNT', currency: preferredCurrency, openingBalance: 0 }
      )
    }
  }, [open, editing, preferredCurrency, reset])

  const onSubmit = async (data: AccountFormData) => {
    try {
      setApiError(null)
      const response = editing
        ? await financeApiService.updateAccount(workspaceId, editing.id, {
            name: data.name,
            institution: data.institution || undefined,
            account_number: data.accountNumber || undefined,
          })
        : await financeApiService.createAccount(workspaceId, {
            type: data.type,
            name: data.name,
            currency: data.currency,
            opening_balance: data.openingBalance,
            institution: data.institution || undefined,
            account_number: data.accountNumber || undefined,
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
      if (code === 'ACCOUNT_NAME_EXISTS') setApiError(t('account.nameExists'))
      else if (code === 'EXCHANGE_RATE_UNAVAILABLE') setApiError(t('transaction.rateUnavailable'))
      else setApiError(t('common.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent id="modal-account">
        <DialogHeader>
          <DialogTitle>{editing ? t('account.edit') : t('account.create')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          {apiError && <Alert type="error" message={apiError} />}

          <FormField label={t('account.name')} id="name-account" error={errors.name?.message}>
            <Input
              id="name-account"
              type="text"
              placeholder={t('account.namePlaceholder')}
              error={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField label={t('account.type')} id="type-account" error={errors.type?.message}>
            <select
              id="type-account"
              // Immutable after creation: the account's kind is part of what it is.
              disabled={!!editing}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              {...register('type')}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('transaction.currency')}
              id="currency-account"
              error={errors.currency?.message}
            >
              <select
                id="currency-account"
                // Immutable: balance, opening balance and the snapshot rate are
                // all denominated in it and none can be restated. To report in a
                // different currency, change the workspace preferred currency.
                disabled={!!editing}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                {...register('currency')}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={t('account.openingBalance')}
              id="opening-balance-account"
              error={errors.openingBalance?.message}
            >
              <Input
                id="opening-balance-account"
                type="number"
                step="0.01"
                min="0"
                // Immutable: later transactions are layered on top of it, so
                // changing it would silently restate every balance since.
                disabled={!!editing}
                placeholder={t('account.openingBalancePlaceholder')}
                error={!!errors.openingBalance}
                {...register('openingBalance')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('account.institution')}
              id="institution-account"
              error={errors.institution?.message}
            >
              <Input
                id="institution-account"
                type="text"
                placeholder={t('account.institutionPlaceholder')}
                error={!!errors.institution}
                {...register('institution')}
              />
            </FormField>

            <FormField
              label={t('account.accountNumber')}
              id="account-number-account"
              error={errors.accountNumber?.message}
            >
              <Input
                id="account-number-account"
                type="text"
                placeholder={t('account.accountNumberPlaceholder')}
                error={!!errors.accountNumber}
                {...register('accountNumber')}
              />
            </FormField>
          </div>

          {editing && (
            <p id="hint-immutable-account" className="text-xs text-gray-500 dark:text-gray-400">
              {t('account.immutableHint')}
            </p>
          )}

          {!editing && isForeign && (
            <p
              id="hint-exchange-rate-account"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {t('transaction.rateHint').replace('{currency}', preferredCurrency)}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              id="btn-cancel-account"
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              id="btn-submit-account"
              type="submit"
              variant={editing ? 'primary' : 'success'}
              loading={busy}
              disabled={busy}
            >
              {editing ? t('common.save') : t('account.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
