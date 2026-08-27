'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { loginSchema, LoginFormData } from '@/schemas/auth'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { useTranslate } from '@/hooks/useTranslate'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setApiError(null)
      const response = await apiClient.login(data.email, data.password)

      if (response.success) {
        setIsSubmitted(true)
        router.push('/app/dashboard')
      } else {
        setApiError(response.message || t('auth.loginSuccessfully'))
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error_code || error.message
      if (errorCode === 'USER_NOT_FOUND') {
        setApiError(t('auth.userNotFound'))
      } else if (errorCode === 'INVALID_CREDENTIALS') {
        setApiError(t('auth.invalidCredentials'))
      } else if (errorCode === 'EMAIL_NOT_VERIFIED') {
        setApiError(t('auth.emailNotVerified'))
      } else if (errorCode === 'ACCOUNT_LOCKED') {
        setApiError(t('auth.accountLocked'))
      } else {
        setApiError(t('common.error'))
      }
    }
  }

  return (
    <AuthLayout
      title={t('auth.signIn')}
      subtitle="Welcome back! Sign in to continue to your dashboard"
      icon={<LogIn className="w-8 h-8 text-white dark:text-slate-900" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {apiError && (
          <Alert type="error" message={apiError} onClose={() => setApiError(null)} />
        )}

        <FormField label={t('auth.email')} id="email-login" error={errors.email?.message}>
          <Input
            id="email-login"
            type="email"
            placeholder={t('auth.emailPlaceholder')}
            error={!!errors.email}
            {...register('email')}
          />
        </FormField>

        <FormField label={t('auth.password')} id="password-login" error={errors.password?.message}>
          <Input
            id="password-login"
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            error={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <Button
          id="btn-submit-login"
          type="submit"
          className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-gray-100 dark:text-slate-900"
          loading={isSubmitting}
          disabled={isSubmitting || isSubmitted}
        >
          {t('auth.signIn')}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400">
              or
            </span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.dontHaveAccount')}{' '}
          <Link
            href="/auth/register"
            className="font-semibold text-slate-800 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            {t('auth.signUpHere')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
