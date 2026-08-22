'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')
  const [workspaceId, setWorkspaceId] = useState<number | null>(null)

  useEffect(() => {
    const acceptInvitation = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setMessage('Invitation token is missing')
        return
      }

      if (!apiClient.isAuthenticated()) {
        // Redirect to login with token
        router.push(`/auth/login?redirect=/invitations/accept?token=${token}`)
        return
      }

      try {
        const response = await apiClient.acceptInvitation(token)

        if (response.success) {
          setStatus('success')
          setMessage('Invitation accepted! Redirecting to workspace...')
          setWorkspaceId(response.data?.workspace_id)
          setTimeout(() => {
            router.push(`/app/workspaces/${response.data.workspace_id}`)
          }, 2000)
        } else {
          setStatus('error')
          setMessage(response.message || 'Failed to accept invitation')
        }
      } catch (error: any) {
        const errorCode = error.response?.data?.error_code
        if (errorCode === 'INVITATION_EXPIRED') {
          setStatus('error')
          setMessage('Invitation has expired. Please ask the workspace owner to send a new one.')
        } else if (errorCode === 'INVITATION_ALREADY_USED') {
          setStatus('error')
          setMessage('This invitation has already been processed.')
        } else {
          setStatus('error')
          setMessage('Failed to accept invitation. Please try again.')
        }
      }
    }

    acceptInvitation()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-8 text-center space-y-4">
          {status === 'loading' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Processing Invitation</h1>
              <Alert type="info" message="Please wait..." />
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Success!</h1>
              <Alert type="success" message={message} />
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Error</h1>
              <Alert type="error" message={message} />
              <Button
                id="btn-back-to-dashboard"
                onClick={() => router.push('/app/dashboard')}
                variant="secondary"
              >
                Back to Dashboard
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptInvitationContent />
    </Suspense>
  )
}
