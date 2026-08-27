import type { Metadata } from 'next'
import './globals.css'
import { DarkModeProvider } from '@/components/providers/dark-mode-provider'
import { LocaleProvider } from '@/components/providers/locale-provider'
import { ToastProvider } from '@/components/providers/toast-provider'

export const metadata: Metadata = {
  title: 'Finance - Personal Finance Management',
  description: 'Manage your finances efficiently',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 transition-colors">
        <DarkModeProvider>
          <LocaleProvider initialLocale="en">
            <ToastProvider>{children}</ToastProvider>
          </LocaleProvider>
        </DarkModeProvider>
      </body>
    </html>
  )
}
