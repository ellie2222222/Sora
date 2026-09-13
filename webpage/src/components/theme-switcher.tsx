'use client'

import React from 'react'
import { useColorTheme, ColorTheme } from '@/components/providers/color-theme-provider'
import { useTheme } from 'next-themes'

const THEMES: { id: ColorTheme; label: string; color: string }[] = [
  { id: 'teal', label: 'Teal (Default)', color: '#2C7A7B' },
  { id: 'ocean', label: 'Ocean', color: '#2B6CB0' },
  { id: 'sunset', label: 'Sunset', color: '#C05621' },
  { id: 'forest', label: 'Forest', color: '#2F855A' },
  { id: 'amethyst', label: 'Amethyst', color: '#6B46C1' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useColorTheme()
  const { theme: mode, setTheme: setMode } = useTheme()

  return (
    <div className="flex flex-col gap-4 p-4 border border-secondary/20 rounded-lg bg-surface shadow-sm max-w-sm">
      <div>
        <h3 className="text-sm font-semibold mb-2">Color Theme</h3>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                theme === t.id ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: t.color }}
              title={t.label}
              aria-label={`Switch to ${t.label} theme`}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Dark Mode</h3>
        <div className="flex gap-2">
          {['light', 'dark', 'system'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                mode === m
                  ? 'bg-primary text-white border-primary'
                  : 'bg-transparent text-secondary border-secondary hover:bg-soft'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
