'use client'

import React, { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useTranslate } from '@/hooks/useTranslate'

export const dynamic = 'force-dynamic'

type VerificationStatus = 'loading' | 'success' | 'error'

function EmailVerificationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslate()
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [message, setMessage] = useState<string>('')

  // Guards against the effect firing twice in React strict mode, which would
  // burn the single-use token and surface TOKEN_ALREADY_USED on the retry.
  const hasVerified = useRef(false)

  useEffect(() => {
    if (hasVerified.current) return
    hasVerified.current = true

    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setMessage(t('auth.missingToken'))
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await apiClient.verifyEmail(token)

        if (response.success) {
          setStatus('success')
          setMessage(t('auth.emailVerifiedSuccessfully'))
          setTimeout(() => router.push('/auth/login'), 2000)
        } else {
          setStatus('error')
          setMessage(response.message || t('auth.emailVerificationFailed'))
        }
      } catch (error: any) {
        const errorCode = error.response?.data?.error_code
        setStatus('error')

        if (errorCode === 'TOKEN_EXPIRED') {
          setMessage(t('auth.tokenExpired'))
        } else if (errorCode === 'TOKEN_ALREADY_USED') {
          setMessage(t('auth.tokenAlreadyUsed'))
        } else {
          setMessage(t('auth.emailVerificationFailed'))
        }
      }
    }

    verifyEmail()
  }, [searchParams, router, t])

  return (
    <AuthLayout
      title={t('auth.verifyEmail')}
      subtitle={t('auth.verifyingEmail')}
      icon={<MailCheck className="h-8 w-8 text-white dark:text-slate-800" />}
    >
      <div id="email-verification-status" className="mt-8 space-y-4 text-center">
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-300">
            <Spinner size="md" />
            <span>{t('auth.verifyingEmail')}</span>
          </div>
        )}

        {status === 'success' && <Alert type="success" message={message} />}

        {status === 'error' && (
          <>
            <Alert type="error" message={message} />
            <Button
              id="btn-back-to-login"
              onClick={() => router.push('/auth/login')}
              variant="secondary"
            >
              {t('auth.signIn')}
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  )
}

export default function EmailVerificationPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Verify Email" subtitle="Confirming your email address">
          <div className="mt-8 flex justify-center">
            <Spinner size="lg" />
          </div>
        </AuthLayout>
      }
    >
      <EmailVerificationContent />
    </Suspense>
  )
}
