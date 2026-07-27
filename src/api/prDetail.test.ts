import { describe, expect, it } from 'vitest'
import { validateReviewBody, splitRepo } from './prDetail'

describe('validateReviewBody', () => {
  it('allows an empty body for APPROVE', () => {
    expect(validateReviewBody('APPROVE', '')).toBeNull()
    expect(validateReviewBody('APPROVE', '   ')).toBeNull()
  })

  it('accepts a non-empty body for APPROVE', () => {
    expect(validateReviewBody('APPROVE', 'looks good')).toBeNull()
  })

  it('rejects an empty body for REQUEST_CHANGES with a clear message', () => {
    const result = validateReviewBody('REQUEST_CHANGES', '')
    expect(result).toBeTruthy()
    expect(result).toContain('Requesting changes')
  })

  it('rejects an empty body for COMMENT with a clear message', () => {
    const result = validateReviewBody('COMMENT', '   ')
    expect(result).toBeTruthy()
    expect(result).toContain('comment needs a body')
  })

  it('accepts a non-empty body for REQUEST_CHANGES', () => {
    expect(validateReviewBody('REQUEST_CHANGES', 'please fix this')).toBeNull()
  })

  it('accepts a non-empty body for COMMENT', () => {
    expect(validateReviewBody('COMMENT', 'nice catch')).toBeNull()
  })
})

describe('splitRepo', () => {
  it('splits owner/name correctly', () => {
    expect(splitRepo('anthropic/claude')).toEqual(['anthropic', 'claude'])
    expect(splitRepo('facebook/react')).toEqual(['facebook', 'react'])
  })

  it('rejects a slug missing a slash', () => {
    expect(() => splitRepo('noslash')).toThrow()
  })

  it('rejects a slug with an empty owner', () => {
    expect(() => splitRepo('/repo')).toThrow()
  })

  it('rejects a slug with an empty name', () => {
    expect(() => splitRepo('owner/')).toThrow()
  })
})
