'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setMessage('Verification token is missing')
        return
      }

      try {
        const response = await apiClient.verifyEmail(token)

        if (response.success) {
          setStatus('success')
          setMessage('Email verified successfully! Redirecting to login...')
          setTimeout(() => {
            router.push('/auth/login')
          }, 2000)
        } else {
          setStatus('error')
          setMessage(response.message || 'Email verification failed')
        }
      } catch (error: any) {
        const errorCode = error.response?.data?.error_code
        if (errorCode === 'TOKEN_EXPIRED') {
          setStatus('error')
          setMessage('Verification token has expired. Please register again.')
        } else if (errorCode === 'TOKEN_ALREADY_USED') {
          setStatus('error')
          setMessage('This verification token has already been used.')
        } else {
          setStatus('error')
          setMessage('Email verification failed. Please try again.')
        }
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <AuthLayout title="Verify Email" subtitle="Confirming your email address">
      <div className="mt-8 text-center space-y-4">
        {status === 'loading' && (
          <Alert
            type="info"
            message="Verifying your email..."
          />
        )}

        {status === 'success' && (
          <>
            <Alert
              type="success"
              message={message}
            />
          </>
        )}

        {status === 'error' && (
          <>
            <Alert
              type="error"
              message={message}
              onClose={() => router.push('/auth/login')}
            />
            <Button
              id="btn-back-to-login"
              onClick={() => router.push('/auth/login')}
              variant="secondary"
            >
              Back to Login
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLayout title="Verify Email" subtitle="Confirming your email address"><div className="mt-8">Loading...</div></AuthLayout>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
