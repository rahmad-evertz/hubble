import { describe, expect, it } from 'vitest'
import { nextTheme, resolveTheme } from './useTheme'

describe('nextTheme', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the OS preference when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ignores the OS preference when a theme is chosen explicitly', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('never returns system, so the attribute always gets a concrete value', () => {
    for (const prefersDark of [true, false]) {
      expect(['light', 'dark']).toContain(resolveTheme('system', prefersDark))
    }
  })
})
