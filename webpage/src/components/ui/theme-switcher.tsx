'use client'

import { useTheme } from 'next-themes'
import { Moon, Palette, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useColorTheme, type ColorTheme } from '@/components/providers/color-theme-provider'

const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
  { id: 'teal', label: 'Teal', swatch: '#2C7A7B' },
  { id: 'ocean', label: 'Ocean', swatch: '#2B6CB0' },
  { id: 'sunset', label: 'Sunset', swatch: '#C05621' },
  { id: 'forest', label: 'Forest', swatch: '#2F855A' },
  { id: 'amethyst', label: 'Amethyst', swatch: '#6B46C1' },
]

export function ThemeSwitcher() {
  const { theme: mode, setTheme: setMode } = useTheme()
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative flex items-center gap-1">
      {/* Dark / light toggle */}
      <button
        id="btn-toggle-dark-mode"
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        className="rounded-lg p-2 text-secondary hover:bg-soft transition-colors"
        aria-label="Toggle dark mode"
      >
        {mode === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      {/* Color theme picker */}
      <button
        id="btn-toggle-color-theme"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg p-2 text-secondary hover:bg-soft transition-colors"
        aria-label="Change color theme"
        aria-expanded={open}
      >
        <Palette className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-secondary/20 bg-surface p-2 shadow-lg">
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                id={`btn-color-theme-${t.id}`}
                onClick={() => {
                  setColorTheme(t.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  colorTheme === t.id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-secondary hover:bg-soft'
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-secondary/20"
                  style={{ backgroundColor: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
