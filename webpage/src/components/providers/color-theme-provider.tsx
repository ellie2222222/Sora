'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type ColorTheme = 'teal' | 'ocean' | 'sunset' | 'forest' | 'amethyst'

interface ColorThemeContextType {
  theme: ColorTheme
  setTheme: (theme: ColorTheme) => void
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined)

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ColorTheme>('teal')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('color-theme') as ColorTheme | null
    if (stored) {
      setThemeState(stored)
      document.documentElement.setAttribute('data-theme', stored)
    }
  }, [])

  const setTheme = (newTheme: ColorTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('color-theme', newTheme)
    if (newTheme === 'teal') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  // Prevent hydration mismatch by not rendering anything theme-dependent on the first pass
  // but we can just render children normally and let CSS handle the rest
  return (
    <ColorThemeContext.Provider value={{ theme: mounted ? theme : 'teal', setTheme }}>
      {children}
    </ColorThemeContext.Provider>
  )
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext)
  if (context === undefined) {
    throw new Error('useColorTheme must be used within a ColorThemeProvider')
  }
  return context
}
