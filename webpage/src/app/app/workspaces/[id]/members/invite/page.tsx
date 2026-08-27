'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiClient } from '@/lib/api-client'
import {
  inviteMemberSchema,
  InviteMemberFormData,
  WORKSPACE_ROLES,
} from '@/schemas/workspace'
import { AppLayout } from '@/components/layouts/app-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField, Input } from '@/components/ui/form-field'
import { useTranslate } from '@/hooks/useTranslate'

export const dynamic = 'force-dynamic'

const ROLE_LABEL_KEYS: Record<string, string> = {
  OWNER: 'workspace.owner',
  MEMBER: 'workspace.member',
}

function InviteMemberForm({ workspaceId }: { workspaceId: number }) {
  const router = useRouter()
  const { t } = useTranslate()

  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // The success alert is shown for 2s before redirecting; isSubmitting is already
  // false by then, so this latch keeps the form from being submitted again in that
  // window (which would send a second invitation to the same address).
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      role: 'MEMBER',
    },
  })

  const onSubmit = async (data: InviteMemberFormData) => {
    try {
      setApiError(null)
      setSuccessMessage(null)
      const response = await apiClient.inviteMember(workspaceId, data.email, data.role)

      if (response.success) {
        setSubmitted(true)
        setSuccessMessage(`${t('workspace.invitationSent')}: ${data.email}`)
        reset()
        setTimeout(() => {
          router.push(`/app/workspaces/${workspaceId}/dashboard`)
        }, 2000)
      } else {
        setApiError(t('common.error'))
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error_code
      if (errorCode === 'USER_ALREADY_MEMBER') {
        setApiError(t('workspace.alreadyMember'))
      } else {
        setApiError(t('common.error'))
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('workspace.inviteMemberToWorkspace')}
        </h1>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {apiError && (
            <Alert type="error" message={apiError} onClose={() => setApiError(null)} />
          )}

          {successMessage && (
            <Alert
              type="success"
              message={successMessage}
              onClose={() => setSuccessMessage(null)}
            />
          )}

          <FormField label={t('auth.email')} id="email-invite" error={errors.email?.message}>
            <Input
              id="email-invite"
              type="email"
              placeholder={t('workspace.inviteEmailPlaceholder')}
              error={!!errors.email}
              {...register('email')}
            />
          </FormField>

          <FormField
            label={t('workspace.memberRole')}
            id="role-invite"
            error={errors.role?.message}
          >
            <select
              id="role-invite"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
              {...register('role')}
            >
              {WORKSPACE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(ROLE_LABEL_KEYS[role])}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex gap-4">
            <Button
              id="btn-submit-invite"
              type="submit"
              variant="success"
              className="flex-1"
              loading={isSubmitting || submitted}
              disabled={isSubmitting || submitted}
            >
              {t('workspace.sendInvitation')}
            </Button>
            <Button
              id="btn-cancel-invite"
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={isSubmitting || submitted}
              onClick={() => router.push(`/app/workspaces/${workspaceId}/dashboard`)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default function InviteMemberPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout
      workspaceId={workspaceId}
      activeKey="invite"
      breadcrumb={t('nav.inviteMember')}
    >
      <InviteMemberForm workspaceId={workspaceId} />
    </AppLayout>
  )
}
