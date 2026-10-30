import { describe, expect, it } from 'vitest'
import { ageSeverity } from './classify'

describe('ageSeverity', () => {
  it('is fresh at and below a week', () => {
    expect(ageSeverity(0)).toBe('fresh')
    expect(ageSeverity(7)).toBe('fresh')
  })

  it('is aging between one and three weeks', () => {
    expect(ageSeverity(8)).toBe('aging')
    expect(ageSeverity(21)).toBe('aging')
  })

  it('is stale beyond three weeks', () => {
    expect(ageSeverity(22)).toBe('stale')
  })
})
