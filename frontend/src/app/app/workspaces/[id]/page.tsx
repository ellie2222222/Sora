'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingState } from '@/components/ui/state'

export const dynamic = 'force-dynamic'

/**
 * The workspace root is its dashboard — everything the old detail page offered
 * (members, invite, categories, settings) now lives in the dashboard sidebar.
 */
export default function WorkspaceRootPage() {
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    router.replace(`/app/workspaces/${params.id}/dashboard`)
  }, [router, params.id])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
      <LoadingState />
    </div>
  )
}
