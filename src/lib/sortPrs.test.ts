import { describe, expect, it } from 'vitest'
import type { PullRequest } from '../types'
import { groupByRepo, sortPrs } from './sortPrs'

function makePr(overrides: Partial<PullRequest>): PullRequest {
  return {
    id: 'id',
    number: 1,
    title: 'title',
    url: '',
    isDraft: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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

describe('sortPrs', () => {
  it('sorts by activity: most recently updated first', () => {
    const a = makePr({ id: 'a', updatedAt: '2026-01-01T00:00:00Z' })
    const b = makePr({ id: 'b', updatedAt: '2026-03-01T00:00:00Z' })
    const c = makePr({ id: 'c', updatedAt: '2026-02-01T00:00:00Z' })
    expect(sortPrs([a, b, c], 'activity').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by age: oldest created first', () => {
    const a = makePr({ id: 'a', createdAt: '2026-01-01T00:00:00Z' })
    const b = makePr({ id: 'b', createdAt: '2026-03-01T00:00:00Z' })
    const c = makePr({ id: 'c', createdAt: '2026-02-01T00:00:00Z' })
    expect(sortPrs([a, b, c], 'age').map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [makePr({ id: 'a' }), makePr({ id: 'b' })]
    const copy = [...input]
    sortPrs(input, 'age')
    expect(input).toEqual(copy)
  })

  it('handles an empty list', () => {
    expect(sortPrs([], 'activity')).toEqual([])
  })
})

describe('groupByRepo', () => {
  it('clusters PRs by repo', () => {
    const a = makePr({ id: 'a', repo: 'acme/widgets' })
    const b = makePr({ id: 'b', repo: 'acme/gadgets' })
    const c = makePr({ id: 'c', repo: 'acme/widgets' })
    const groups = groupByRepo([a, b, c])
    expect(groups.map((g) => g.repo)).toEqual(['acme/gadgets', 'acme/widgets'])
    expect(groups.find((g) => g.repo === 'acme/widgets')?.prs.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('orders groups alphabetically regardless of input order', () => {
    const groups = groupByRepo([
      makePr({ id: 'a', repo: 'zzz/last' }),
      makePr({ id: 'b', repo: 'aaa/first' }),
    ])
    expect(groups.map((g) => g.repo)).toEqual(['aaa/first', 'zzz/last'])
  })

  it('preserves input order within a group rather than re-sorting', () => {
    const b = makePr({ id: 'b', updatedAt: '2026-01-01T00:00:00Z' })
    const a = makePr({ id: 'a', updatedAt: '2026-02-01T00:00:00Z' })
    const groups = groupByRepo([b, a])
    expect(groups[0].prs.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('handles an empty list', () => {
    expect(groupByRepo([])).toEqual([])
  })
})
