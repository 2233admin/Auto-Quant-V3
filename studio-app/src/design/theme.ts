import { useCallback, useLayoutEffect, useState } from 'react'
import { startThemeTransition } from '../components/motion/themeTransition'

export type ThemeName = 'dark' | 'light'

// Remembered theme key.
export const THEME_KEY = 'aq-studio-theme'

/** The remembered theme; dark is the default and anything unreadable falls back to it. */
export function storedTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* Without storage the choice lasts for this page only. */
  }
}

/** Current theme plus a setter that applies it to <html> and remembers it. */
export function useTheme(): [ThemeName, (theme: ThemeName) => void] {
  const [theme, setTheme] = useState<ThemeName>(storedTheme)
  // Layout effect: applied before children read token values in their passive effects.
  useLayoutEffect(() => applyTheme(theme), [theme])
  // Only a user's choice fades; the first applyTheme above (stored theme on load) stays instant.
  const choose = useCallback((next: ThemeName) => {
    startThemeTransition()
    setTheme(next)
  }, [])
  return [theme, choose]
}
