'use client'

import React from 'react'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  icon?: React.ReactNode
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, icon }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-200 rounded-full opacity-5 blur-3xl dark:bg-gray-700"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-200 rounded-full opacity-5 blur-3xl dark:bg-gray-700"></div>

      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6">
          {/* Header section with icon */}
          <div className="text-center space-y-4">
            {icon && (
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-slate-800 dark:bg-white rounded-full flex items-center justify-center shadow-lg">
                  {icon}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="text-base text-gray-600 dark:text-gray-300">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Form content */}
          {children}
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          © 2024 Finance Manager. All rights reserved.
        </p>
      </div>
    </div>
  )
}
