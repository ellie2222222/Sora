'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Coins, Save } from 'lucide-react'
import { AppLayout, useCurrentWorkspace } from '@/components/layouts/app-layout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField, Input } from '@/components/ui/form-field'
import { useToast } from '@/components/providers/toast-provider'
import { useTranslate } from '@/hooks/useTranslate'
import { financeApiService } from '@/lib/finance-api.service'
import { CURRENCIES, type Currency } from '@/schemas/currency'

export const dynamic = 'force-dynamic'

function SettingsContent() {
  const workspace = useCurrentWorkspace()
  const { t } = useTranslate()
  const router = useRouter()
  const { toast } = useToast()

  const isOwner = workspace.user_role === 'OWNER'

  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [currency, setCurrency] = useState<Currency>(workspace.currency as Currency)
  const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(null)

  useEffect(() => {
    setName(workspace.name)
    setDescription(workspace.description ?? '')
    setCurrency(workspace.currency as Currency)
  }, [workspace])

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSavingDetails(true)
      setDetailsError(null)
      await financeApiService.updateWorkspace(workspace.id, {
        name,
        description: description || undefined,
      })
      toast(t('workspace.updatedSuccessfully'), 'success')
      // The workspace name lives in the layout's own state, loaded once.
      router.refresh()
    } catch {
      setDetailsError(t('common.error'))
    } finally {
      setSavingDetails(false)
    }
  }

  // Rejection stays with the ConfirmDialog so a failed change never looks applied.
  const applyCurrency = async () => {
    if (!pendingCurrency) return
    const response = await financeApiService.changePreferredCurrency(
      workspace.id,
      pendingCurrency
    )
    const restated = Number(response.data?.restated_transactions ?? 0)
    toast(
      t('workspace.currencyChanged')
        .replace('{currency}', pendingCurrency)
        .replace('{count}', String(restated)),
      'success'
    )
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('nav.settings')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('workspace.settingsHint')}</p>
      </div>

      {!isOwner && <Alert type="info" message={t('workspace.ownerOnly')} />}

      <Card>
        <CardHeader title={t('workspace.details')} />
        <CardContent>
          <form onSubmit={saveDetails} className="space-y-3">
            {detailsError && <Alert type="error" message={detailsError} />}

            <FormField label={t('workspace.workspaceName')} id="name-workspace-settings">
              <Input
                id="name-workspace-settings"
                type="text"
                value={name}
                disabled={!isOwner || savingDetails}
                placeholder={t('workspace.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label={t('workspace.description')} id="description-workspace-settings">
              <textarea
                id="description-workspace-settings"
                rows={3}
                value={description}
                disabled={!isOwner || savingDetails}
                placeholder={t('workspace.descriptionPlaceholder')}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </FormField>

            <div className="flex justify-end">
              <Button
                id="btn-submit-workspace-settings"
                type="submit"
                loading={savingDetails}
                disabled={!isOwner || savingDetails || !name.trim()}
              >
                <Save className="h-4 w-4" />
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={t('workspace.preferredCurrency')}
          description={t('workspace.preferredCurrencyChangeHint')}
          action={<Badge tone="neutral">{workspace.currency}</Badge>}
        />
        <CardContent className="space-y-3">
          <FormField label={t('workspace.preferredCurrency')} id="currency-workspace-settings">
            <select
              id="currency-workspace-settings"
              value={currency}
              disabled={!isOwner}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>

          <Alert type="info" message={t('workspace.currencyRestatementWarning')} />

          <div className="flex justify-end">
            <Button
              id="btn-change-preferred-currency"
              type="button"
              variant="warning"
              disabled={!isOwner || currency === workspace.currency}
              onClick={() => setPendingCurrency(currency)}
            >
              <Coins className="h-4 w-4" />
              {t('workspace.changeCurrency')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        id="modal-confirm-currency-change"
        variant="warning"
        open={pendingCurrency !== null}
        onOpenChange={(next) => !next && setPendingCurrency(null)}
        title={t('workspace.changeCurrency')}
        description={t('workspace.currencyRestatementWarning')}
        detail={
          pendingCurrency && (
            <span className="font-medium">
              {workspace.currency} → {pendingCurrency}
            </span>
          )
        }
        confirmLabel={t('workspace.changeCurrency')}
        cancelLabel={t('common.back')}
        errorMessage={t('common.error')}
        onConfirm={applyCurrency}
      />
    </div>
  )
}

export default function WorkspaceSettingsPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout workspaceId={workspaceId} activeKey="settings" breadcrumb={t('nav.settings')}>
      <SettingsContent />
    </AppLayout>
  )
}
