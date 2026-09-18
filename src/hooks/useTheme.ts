import { useCallback, useEffect, useState } from 'react'
import * as storage from '../lib/storage'

export type Theme = 'system' | 'light' | 'dark'

/** What actually reaches <html>. 'system' is resolved away before stamping. */
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Kept pure and exported so it can be unit-tested, and so the pre-paint script
 * in index.html has one documented rule to mirror.
 */
export function resolveTheme(stored: Theme, prefersDark: boolean): ResolvedTheme {
  if (stored === 'system') return prefersDark ? 'dark' : 'light'
  return stored
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => storage.read<Theme>(KEY, 'system'))

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    // Always a concrete value, never removed: index.css has no
    // prefers-color-scheme tier to fall back to, which is what keeps every
    // dark rule declared once instead of twice.
    const stamp = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme(theme, query.matches))
    }
    stamp()
    if (theme !== 'system') return
    query.addEventListener('change', stamp)
    return () => query.removeEventListener('change', stamp)
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
