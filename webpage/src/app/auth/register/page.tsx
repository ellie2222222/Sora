'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { registerSchema, RegisterFormData } from '@/schemas/auth'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { useTranslate } from '@/hooks/useTranslate'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setApiError(null)
      const response = await apiClient.register(data.email, data.password, data.fullName)

      if (response.success) {
        setIsSubmitted(true)
        setSuccessMessage(t('auth.registeredSuccessfully'))
        setTimeout(() => {
          router.push('/auth/login')
        }, 15000)
      } else {
        setApiError(response.message || t('common.error'))
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error_code || error.message
      if (errorCode === 'USER_EMAIL_EXISTS') {
        setApiError(t('auth.emailAlreadyExists'))
      } else {
        setApiError(t('common.error'))
      }
    }
  }

  return (
    <AuthLayout
      title={t('auth.signUp')}
      subtitle="Create a new account to get started with Finance Manager"
      icon={<UserPlus className="w-8 h-8 text-white dark:text-slate-900" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {apiError && (
          <Alert type="error" message={apiError} onClose={() => setApiError(null)} />
        )}

        {successMessage && (
          <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
        )}

        <FormField label={t('auth.fullName')} id="fullName-register" error={errors.fullName?.message}>
          <Input
            id="fullName-register"
            type="text"
            placeholder={t('auth.fullNamePlaceholder')}
            error={!!errors.fullName}
            {...register('fullName')}
          />
        </FormField>

        <FormField label={t('auth.email')} id="email-register" error={errors.email?.message}>
          <Input
            id="email-register"
            type="email"
            placeholder={t('auth.emailPlaceholder')}
            error={!!errors.email}
            {...register('email')}
          />
        </FormField>

        <FormField label={t('auth.password')} id="password-register" error={errors.password?.message}>
          <Input
            id="password-register"
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            error={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <Button
          id="btn-submit-register"
          type="submit"
          className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-gray-100 dark:text-slate-900"
          loading={isSubmitting}
          disabled={isSubmitting || isSubmitted}
        >
          {t('auth.signUp')}
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
          {t('auth.alreadyHaveAccount')}{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-slate-800 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            {t('auth.signInHere')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
