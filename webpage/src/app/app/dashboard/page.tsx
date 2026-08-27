'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wallet } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, LoadingState } from '@/components/ui/state'
import { CreateWorkspaceDialog } from '@/components/workspace/create-workspace-dialog'
import { useTranslate } from '@/hooks/useTranslate'

export const dynamic = 'force-dynamic'

interface WorkspaceSummary {
  id: number
}

/**
 * Post-login landing route. The dashboard itself is workspace-scoped
 * (`/app/workspaces/{id}/dashboard`, SDS §3.2), so this resolves which
 * workspace to open and forwards there.
 */
export default function DashboardRedirectPage() {
  const router = useRouter()
  const { t } = useTranslate()
  const [failed, setFailed] = useState(false)
  const [noWorkspace, setNoWorkspace] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!apiClient.isAuthenticated()) {
      router.push('/auth/login')
      return
    }

    const resolveWorkspace = async () => {
      try {
        const response = await apiClient.listWorkspaces()
        const workspaces: WorkspaceSummary[] = response.data?.workspaces || []

        if (workspaces.length > 0) {
          router.replace(`/app/workspaces/${workspaces[0].id}/dashboard`)
        } else {
          setNoWorkspace(true)
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          router.push('/auth/login')
          return
        }
        setFailed(true)
      }
    }

    resolveWorkspace()
  }, [router])

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4 text-center">
          <Alert type="error" message={t('common.error')} />
          <Button
            id="btn-retry-dashboard"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            {t('common.retry') || 'Retry'}
          </Button>
        </div>
      </div>
    )
  }

  if (noWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <Card className="w-full max-w-md p-6 text-center">
          <EmptyState
            id="empty-workspaces"
            icon={<Wallet className="h-8 w-8 text-gray-400" />}
            title={t('workspace.noWorkspaces')}
            action={
              <Button id="btn-create-first-workspace" variant="success" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('workspace.createWorkspace')}
              </Button>
            }
          />
        </Card>
        <CreateWorkspaceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(workspaceId) => router.push(`/app/workspaces/${workspaceId}/dashboard`)}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
      <LoadingState label={t('common.loading')} />
    </div>
  )
}
