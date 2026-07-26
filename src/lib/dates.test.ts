import { describe, expect, it } from 'vitest'
import { daysSince, monthKeys, monthLabel, monthRange, relativeAge } from './dates'

const NOW = new Date('2026-07-26T12:00:00Z')

describe('monthKeys', () => {
  it('returns the window oldest-first, ending with the current month', () => {
    const keys = monthKeys(12, NOW)
    expect(keys).toHaveLength(12)
    expect(keys[0]).toBe('2025-08')
    expect(keys[11]).toBe('2026-07')
  })

  it('crosses the year boundary correctly', () => {
    expect(monthKeys(3, new Date('2026-01-15T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ])
  })
})

describe('monthRange', () => {
  it.each([
    ['2026-01', '2026-01-31'],
    ['2026-02', '2026-02-28'],
    ['2024-02', '2024-02-29'],
    ['2026-04', '2026-04-30'],
    ['2026-12', '2026-12-31'],
  ])('ends %s on %s', (key, end) => {
    expect(monthRange(key)).toEqual({ start: `${key}-01`, end })
  })
})

describe('monthLabel', () => {
  it('is stable regardless of the viewer timezone', () => {
    expect(monthLabel('2026-01')).toBe('Jan')
    expect(monthLabel('2026-12')).toBe('Dec')
  })
})

describe('relativeAge', () => {
  it.each([
    ['2026-07-26T11:59:30Z', 'just now'],
    ['2026-07-26T11:46:00Z', '14m'],
    ['2026-07-26T09:00:00Z', '3h'],
    ['2026-07-15T12:00:00Z', '11d'],
    ['2026-03-26T12:00:00Z', '4mo'],
  ])('renders %s as %s', (iso, expected) => {
    expect(relativeAge(iso, NOW)).toBe(expected)
  })
})

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince('2026-07-15T12:00:00Z', NOW)).toBe(11)
    expect(daysSince('2026-07-26T00:00:00Z', NOW)).toBe(0)
  })
})
