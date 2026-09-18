import { describe, expect, it } from 'vitest'
import type { AppConfig, PullRequest } from '../types'
import { prFacts } from './prFacts'

const NOW = new Date('2026-07-26T12:00:00Z')

const CONFIG: AppConfig = {
  githubToken: 't',
  username: 'octocat',
  org: 'acme',
  apiBaseUrl: 'https://api.github.com',
  ticketPattern: '',
  ticketBaseUrl: '',
}

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

describe('prFacts', () => {
  it('shortens the repo to its name, dropping the owner', () => {
    expect(prFacts(makePr({}), CONFIG, NOW).repoName).toBe('widgets')
  })

  it('falls back to the whole slug when there is no slash', () => {
    expect(prFacts(makePr({ repo: 'widgets' }), CONFIG, NOW).repoName).toBe('widgets')
  })

  it('marks a bot author', () => {
    expect(prFacts(makePr({ authorIsBot: true }), CONFIG, NOW).authorLabel).toBe('octocat (bot)')
  })

  it('reports no author label when the author is gone', () => {
    expect(prFacts(makePr({ authorLogin: null }), CONFIG, NOW).authorLabel).toBeNull()
  })

  it('offers a ticket link only when both the pattern and the base URL are set', () => {
    const pr = makePr({ title: 'ABC-42 fix the thing' })
    expect(prFacts(pr, { ...CONFIG, ticketPattern: '([A-Z]{2,}-\\d+)' }, NOW).ticket).toBeNull()
    expect(prFacts(pr, { ...CONFIG, ticketBaseUrl: 'https://t.example/b' }, NOW).ticket).toBeNull()
    expect(
      prFacts(
        pr,
        { ...CONFIG, ticketPattern: '([A-Z]{2,}-\\d+)', ticketBaseUrl: 'https://t.example/b' },
        NOW,
      ).ticket,
    ).toEqual({ key: 'ABC-42', href: 'https://t.example/b/ABC-42' })
  })

  it('falls back to ci-NONE when no checks reported', () => {
    const facts = prFacts(makePr({ checkState: null }), CONFIG, NOW)
    expect(facts.ciClass).toBe('ci-NONE')
    expect(facts.ciTitle).toBe('No checks reported')
  })

  it('derives the age class from the severity thresholds', () => {
    expect(prFacts(makePr({ createdAt: '2026-07-25T12:00:00Z' }), CONFIG, NOW).ageClass).toBe(
      'age-fresh',
    )
    expect(prFacts(makePr({ createdAt: '2026-07-16T12:00:00Z' }), CONFIG, NOW).ageClass).toBe(
      'age-aging',
    )
    expect(prFacts(makePr({ createdAt: '2026-06-20T12:00:00Z' }), CONFIG, NOW).ageClass).toBe(
      'age-stale',
    )
  })

  it('leaves review and ownReview absent when there is nothing to say', () => {
    const facts = prFacts(makePr({}), CONFIG, NOW)
    expect(facts.review).toBeNull()
    expect(facts.ownReview).toBeUndefined()
    expect(facts.hasConflict).toBe(false)
  })

  it('reports the review decision and your own latest review', () => {
    const facts = prFacts(
      makePr({ reviewDecision: 'CHANGES_REQUESTED', userLatestReview: 'APPROVED' }),
      CONFIG,
      NOW,
    )
    expect(facts.review).toEqual({ label: 'Changes requested', className: 'badge-danger' })
    expect(facts.ownReview).toBe('you approved')
  })

  it('does not mutate the pull request', () => {
    const pr = makePr({})
    const copy = structuredClone(pr)
    prFacts(pr, CONFIG, NOW)
    expect(pr).toEqual(copy)
  })
})
