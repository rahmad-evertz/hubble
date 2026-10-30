import { useCallback, useEffect, useState } from 'react'
import * as storage from '../lib/storage'

/** Orthogonal to Theme: either style renders in light and dark. */
export type Style = 'classic' | 'glass'

const KEY = 'style'

export const STYLE_LABEL: Record<Style, string> = {
  classic: 'Classic',
  glass: 'Liquid glass',
}

/** Anything unrecognised, including a value from a future build, is Classic. */
export function resolveStyle(stored: unknown): Style {
  return stored === 'glass' ? 'glass' : 'classic'
}

type Brand = { brand: string }

/**
 * The edge lens is `backdrop-filter: url(#hub-lens)`, which only Chromium
 * renders. Not detectable with @supports: Safari accepts the syntax and then
 * draws nothing, dropping the blur along with it. userAgentData is itself
 * Chromium-only, so its absence is a reliable "no".
 */
export function supportsLens(brands: Brand[] | undefined): boolean {
  return Boolean(brands?.some((b) => b.brand === 'Chromium'))
}

export function useStyle(): [Style, (next: Style) => void] {
  const [style, setStyle] = useState<Style>(() => resolveStyle(storage.read<unknown>(KEY, null)))

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-style', style)
    const brands = (navigator as Navigator & { userAgentData?: { brands: Brand[] } }).userAgentData
      ?.brands
    if (style === 'glass' && supportsLens(brands)) {
      root.setAttribute('data-lens', 'on')
    } else {
      root.removeAttribute('data-lens')
    }
  }, [style])

  const update = useCallback((next: Style) => {
    storage.write(KEY, next)
    setStyle(next)
  }, [])

  return [style, update]
}
