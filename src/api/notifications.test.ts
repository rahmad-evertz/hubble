import { describe, expect, it } from 'vitest'
import { reasonLabel, reasonRank, reasonTier } from './notifications'

describe('reasonRank', () => {
  it('ranks review_requested above mention', () => {
    expect(reasonRank('review_requested')).toBeLessThan(reasonRank('mention'))
  })

  it('ranks mention above subscribed', () => {
    expect(reasonRank('mention')).toBeLessThan(reasonRank('subscribed'))
  })

  it('ranks an unknown reason last, after every known reason', () => {
    expect(reasonRank('some_new_reason_github_added')).toBe(reasonRank('subscribed') + 1)
  })
})

describe('reasonLabel', () => {
  it('maps a known reason to its friendly label', () => {
    expect(reasonLabel('review_requested')).toBe('Review requested')
    expect(reasonLabel('ci_activity')).toBe('CI activity')
  })

  it('falls back to a de-underscored version of an unknown reason', () => {
    expect(reasonLabel('some_new_reason')).toBe('some new reason')
  })
})

describe('reasonTier', () => {
  it('puts what demands an answer in the nearest band', () => {
    expect(reasonTier('review_requested')).toBe('demanding')
    expect(reasonTier('mention')).toBe('demanding')
  })

  it('puts your own threads and direct activity in the middle band', () => {
    expect(reasonTier('assign')).toBe('active')
    expect(reasonTier('author')).toBe('active')
    expect(reasonTier('comment')).toBe('active')
  })

  it('pushes chatter to the back band', () => {
    expect(reasonTier('ci_activity')).toBe('ambient')
    expect(reasonTier('subscribed')).toBe('ambient')
  })

  it('treats an unknown reason as ambient rather than demanding', () => {
    expect(reasonTier('something_new')).toBe('ambient')
  })
})
