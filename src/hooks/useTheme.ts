import { useCallback, useEffect, useState } from 'react'
import * as storage from '../lib/storage'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => storage.read<Theme>(KEY, 'system'))

  useEffect(() => {
    const root = document.documentElement
    // Removing the attribute hands control back to prefers-color-scheme.
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  const update = useCallback((next: Theme) => {
    storage.write(KEY, next)
    setTheme(next)
  }, [])

  return [theme, update]
}

export function nextTheme(current: Theme): Theme {
  return current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'
}

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
}
