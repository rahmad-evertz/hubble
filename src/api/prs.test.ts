import { describe, expect, it } from 'vitest'
import { patchPanelsPr, removePanelsPr } from './prs'
import type { PanelsData, PullRequest, PrRole } from '../types'

function makePr(id: string, roles: PrRole[] = []): PullRequest {
  return {
    id,
    number: 1,
    title: 'Test PR',
    url: 'https://github.com/test/repo/pull/1',
    isDraft: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    repo: 'test/repo',
    authorLogin: 'author',
    authorIsBot: false,
    reviewDecision: null,
    mergeable: 'UNKNOWN',
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    userLatestReview: null,
    checkState: null,
    waitingOn: [],
    roles,
  }
}

function makePanelsData(prs: PullRequest[]): PanelsData {
  const mine = prs.filter((p) => p.roles.includes('author'))
  const requested = prs.filter((p) => p.roles.includes('reviewer'))
  const assigned = prs.filter((p) => p.roles.includes('assignee'))
  const mentioned = prs.filter((p) => p.roles.includes('mentioned'))
  return {
    panels: {
      mine: { total: mine.length, prs: mine, hasMore: false },
      requested: { total: requested.length, prs: requested, hasMore: false },
      assigned: { total: assigned.length, prs: assigned, hasMore: false },
      mentioned: { total: mentioned.length, prs: mentioned, hasMore: false },
    },
    all: prs,
  }
}

describe('patchPanelsPr', () => {
  it('patches a PR that appears in a single panel', () => {
    const pr = makePr('pr-1', ['author'])
    const data = makePanelsData([pr])
    const patched = patchPanelsPr(data, 'pr-1', { isDraft: true })

    expect(patched?.panels.mine.prs[0].isDraft).toBe(true)
    expect(patched?.all[0].isDraft).toBe(true)
  })

  it('patches a PR that appears in multiple panels', () => {
    const pr = makePr('pr-1', ['author', 'reviewer'])
    const data = makePanelsData([pr])
    const patched = patchPanelsPr(data, 'pr-1', { userLatestReview: 'APPROVED' })

    expect(patched?.panels.mine.prs[0].userLatestReview).toBe('APPROVED')
    expect(patched?.panels.requested.prs[0].userLatestReview).toBe('APPROVED')
    expect(patched?.all[0].userLatestReview).toBe('APPROVED')
  })

  it('does not affect other PRs', () => {
    const pr1 = makePr('pr-1', ['author'])
    const pr2 = makePr('pr-2', ['author'])
    const data = makePanelsData([pr1, pr2])
    const patched = patchPanelsPr(data, 'pr-1', { isDraft: true })

    const otherPr = patched?.panels.mine.prs.find((p) => p.id === 'pr-2')
    expect(otherPr?.isDraft).toBe(false)
  })

  it('returns null when data is null', () => {
    expect(patchPanelsPr(null, 'pr-1', { isDraft: true })).toBeNull()
  })
})

describe('removePanelsPr', () => {
  it('removes a PR from all panels', () => {
    const pr1 = makePr('pr-1', ['author', 'reviewer'])
    const pr2 = makePr('pr-2', ['author'])
    const data = makePanelsData([pr1, pr2])
    const removed = removePanelsPr(data, 'pr-1')

    expect(removed?.panels.mine.prs).toHaveLength(1)
    expect(removed?.panels.requested.prs).toHaveLength(0)
    expect(removed?.all).toHaveLength(1)
  })

  it('decrements the total count for affected panels', () => {
    const pr1 = makePr('pr-1', ['author'])
    const pr2 = makePr('pr-2', ['reviewer'])
    const data = makePanelsData([pr1, pr2])
    const removed = removePanelsPr(data, 'pr-1')

    expect(removed?.panels.mine.total).toBe(0)
    expect(removed?.panels.requested.total).toBe(1)
  })

  it('does not affect unrelated panels total', () => {
    const pr1 = makePr('pr-1', ['author'])
    const data = makePanelsData([pr1])
    const removed = removePanelsPr(data, 'pr-1')

    expect(removed?.panels.requested.total).toBe(0)
    expect(removed?.panels.assigned.total).toBe(0)
  })

  it('returns null when data is null', () => {
    expect(removePanelsPr(null, 'pr-1')).toBeNull()
  })
})
