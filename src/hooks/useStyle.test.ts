import { describe, expect, it } from 'vitest'
import { resolveStyle, supportsLens } from './useStyle'

describe('resolveStyle', () => {
  it('accepts both styles', () => {
    expect(resolveStyle('glass')).toBe('glass')
    expect(resolveStyle('classic')).toBe('classic')
  })

  it('falls back to classic for anything missing or unrecognised', () => {
    for (const stored of [null, undefined, '', 'Glass', 'neon', 42, {}]) {
      expect(resolveStyle(stored)).toBe('classic')
    }
  })
})

describe('supportsLens', () => {
  it('is true for a Chromium-based browser', () => {
    expect(
      supportsLens([{ brand: 'Google Chrome' }, { brand: 'Chromium' }, { brand: 'Not.A/Brand' }]),
    ).toBe(true)
  })

  it('is false without userAgentData, which is how Safari and Firefox present', () => {
    expect(supportsLens(undefined)).toBe(false)
  })

  it('is false when no brand is Chromium', () => {
    expect(supportsLens([{ brand: 'Not.A/Brand' }])).toBe(false)
  })
})
