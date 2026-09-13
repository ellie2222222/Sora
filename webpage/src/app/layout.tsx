import type { Metadata } from 'next'
import './globals.css'
import { DarkModeProvider } from '@/components/providers/dark-mode-provider'
import { ColorThemeProvider } from '@/components/providers/color-theme-provider'
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
      <body className="bg-background text-secondary transition-colors duration-300">
        <DarkModeProvider>
          <ColorThemeProvider>
            <LocaleProvider initialLocale="en">
              <ToastProvider>{children}</ToastProvider>
            </LocaleProvider>
          </ColorThemeProvider>
        </DarkModeProvider>
      </body>
    </html>
  )
}
