'use client'

import { useLocale } from '@/components/providers/locale-provider'
import { Locale } from '../../../i18n.config'
import { Globe } from 'lucide-react'
import { useState } from 'react'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  const [isOpen, setIsOpen] = useState(false)

  const languages: { code: Locale; name: string; flag: string }[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
      >
        <Globe className="h-5 w-5" />
        <span className="text-sm font-medium">{locale.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLocale(lang.code)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors ${
                locale === lang.code
                  ? 'bg-gray-100 dark:bg-gray-900/20 text-gray-900 dark:text-gray-50'
                  : 'text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
