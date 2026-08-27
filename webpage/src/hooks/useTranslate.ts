import { useCallback } from 'react'
import { useLocale } from '@/components/providers/locale-provider'
import { getTranslation } from '@/lib/i18n'

export function useTranslate() {
  const { locale } = useLocale()

  // Memoised on locale so `t` is referentially stable — effects that list it as
  // a dependency would otherwise re-run on every render.
  const t = useCallback((key: string) => getTranslation(locale, key), [locale])

  return { t }
}
