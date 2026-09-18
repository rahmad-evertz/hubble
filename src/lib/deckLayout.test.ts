import { describe, expect, it } from 'vitest'
import type { PullRequest } from '../types'
import { deckLayout, urgencyScore } from './deckLayout'

const NOW = new Date('2026-07-26T12:00:00Z')

function makePr(overrides: Partial<PullRequest>): PullRequest {
  return {
    id: 'id',
    number: 1,
    title: 'title',
    url: '',
    isDraft: false,
    createdAt: '2026-07-25T12:00:00Z',
    updatedAt: '2026-07-25T12:00:00Z',
    repo: 'acme/widgets',
    authorLogin: 'octocat',
    authorIsBot: false,
    reviewDecision: null,
    mergeable: 'MERGEABLE',
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    userLatestReview: null,
    checkState: null,
    waitingOn: [],
    roles: ['author'],
    ...overrides,
  }
}

describe('urgencyScore', () => {
  it('scores a fresh, green, unblocked pull request at zero', () => {
    expect(urgencyScore(makePr({}), NOW)).toBe(0)
  })

  it.each(['FAILURE', 'ERROR'] as const)('scores a %s check', (checkState) => {
    expect(urgencyScore(makePr({ checkState }), NOW)).toBeGreaterThan(0)
  })

  it('adds conflict and changes-requested on top of a failing check', () => {
    const failing = urgencyScore(makePr({ checkState: 'FAILURE' }), NOW)
    const all = urgencyScore(
      makePr({
        checkState: 'FAILURE',
        mergeable: 'CONFLICTING',
        reviewDecision: 'CHANGES_REQUESTED',
      }),
      NOW,
    )
    expect(all).toBeGreaterThan(failing)
  })

  it('counts a pending review request only until you have reviewed', () => {
    const pending = urgencyScore(makePr({ roles: ['reviewer'], userLatestReview: null }), NOW)
    const answered = urgencyScore(
      makePr({ roles: ['reviewer'], userLatestReview: 'COMMENTED' }),
      NOW,
    )
    expect(pending).toBeGreaterThan(answered)
  })

  it('rises with age severity', () => {
    const fresh = urgencyScore(makePr({ createdAt: '2026-07-23T12:00:00Z' }), NOW)
    const aging = urgencyScore(makePr({ createdAt: '2026-07-16T12:00:00Z' }), NOW)
    const stale = urgencyScore(makePr({ createdAt: '2026-06-20T12:00:00Z' }), NOW)
    expect(fresh).toBeLessThan(aging)
    expect(aging).toBeLessThan(stale)
  })

  it('damps a draft, which is not asking anyone for anything yet', () => {
    const ready = urgencyScore(makePr({ checkState: 'FAILURE' }), NOW)
    const draft = urgencyScore(makePr({ checkState: 'FAILURE', isDraft: true }), NOW)
    expect(draft).toBeLessThan(ready)
  })

  it('never exceeds 1', () => {
    const worst = makePr({
      checkState: 'FAILURE',
      mergeable: 'CONFLICTING',
      reviewDecision: 'CHANGES_REQUESTED',
      roles: ['reviewer'],
      userLatestReview: null,
      createdAt: '2025-01-01T00:00:00Z',
    })
    expect(urgencyScore(worst, NOW)).toBeLessThanOrEqual(1)
  })

  it('uses the injected now rather than the clock', () => {
    const pr = makePr({ createdAt: '2026-06-20T12:00:00Z' })
    const laterNow = new Date('2026-06-21T12:00:00Z')
    expect(urgencyScore(pr, laterNow)).toBeLessThan(urgencyScore(pr, NOW))
  })
})

describe('deckLayout', () => {
  it('puts the first card nearest and each later card further back', () => {
    const layout = deckLayout([makePr({ id: 'a' }), makePr({ id: 'b' }), makePr({ id: 'c' })], NOW)
    expect(layout[0].depth).toBeLessThan(layout[1].depth)
    expect(layout[1].depth).toBeLessThan(layout[2].depth)
  })

  it('never reorders cards, however urgent one at the back is', () => {
    const calm = makePr({ id: 'calm' })
    const urgent = makePr({
      id: 'urgent',
      checkState: 'FAILURE',
      mergeable: 'CONFLICTING',
      reviewDecision: 'CHANGES_REQUESTED',
      roles: ['reviewer'],
      createdAt: '2025-01-01T00:00:00Z',
    })
    const layout = deckLayout([calm, urgent], NOW)
    expect(layout[0].depth).toBeLessThan(layout[1].depth)
  })

  it('pulls an urgent card forward inside its own slot', () => {
    const calm = deckLayout([makePr({})], NOW)[0]
    const urgent = deckLayout([makePr({ checkState: 'FAILURE' })], NOW)[0]
    expect(urgent.depth).toBeLessThan(calm.depth)
    for (const card of [calm, urgent]) {
      expect(card.depth).toBeGreaterThanOrEqual(0)
      expect(card.depth).toBeLessThanOrEqual(0.45)
    }
  })

  it('returns ids in input order', () => {
    const layout = deckLayout([makePr({ id: 'a' }), makePr({ id: 'b' })], NOW)
    expect(layout.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [makePr({ id: 'a' }), makePr({ id: 'b' })]
    const copy = structuredClone(input)
    deckLayout(input, NOW)
    expect(input).toEqual(copy)
  })

  it('handles an empty list', () => {
    expect(deckLayout([], NOW)).toEqual([])
  })
})
