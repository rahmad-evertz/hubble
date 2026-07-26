import { describe, expect, it } from 'vitest'
import { monthAlias, openPrQueries, statsQueries } from './queries'

const ctx = { username: 'octocat', org: 'acme-inc' }

describe('openPrQueries', () => {
  it('scopes every panel to open PRs in the org', () => {
    const q = openPrQueries(ctx)
    for (const query of Object.values(q)) {
      // Without is:open these return lifetime totals, which is the difference
      // between tens of rows and thousands.
      expect(query).toContain('is:pr')
      expect(query).toContain('is:open')
      expect(query).toContain('org:acme-inc')
    }
  })

  it('uses the right qualifier per panel', () => {
    const q = openPrQueries(ctx)
    expect(q.mine).toContain('author:octocat')
    expect(q.requested).toContain('review-requested:octocat')
    expect(q.assigned).toContain('assignee:octocat')
    expect(q.mentioned).toContain('mentions:octocat')
  })

  it('omits the org qualifier entirely when no org is configured', () => {
    const q = openPrQueries({ username: 'octocat', org: '' })
    expect(q.mine).not.toContain('org:')
    expect(q.mine).toContain('author:octocat')
  })

  it('trims surrounding whitespace instead of embedding it in the query', () => {
    const q = openPrQueries({ username: '  octocat  ', org: '  acme-inc  ' })
    expect(q.mine).toBe('is:pr is:open org:acme-inc sort:updated-desc author:octocat')
  })

  it.each(['bad name', 'no:colons', 'trailing-', '-leading', '', 'a'.repeat(40)])(
    'rejects %j rather than silently changing the query',
    (bad) => {
      expect(() => openPrQueries({ username: bad, org: 'acme-inc' })).toThrow()
    },
  )

  it('rejects an invalid org', () => {
    expect(() => openPrQueries({ username: 'octocat', org: 'has space' })).toThrow()
  })
})

describe('statsQueries', () => {
  const months = ['2026-01', '2026-02']

  it('builds an inclusive merged range per month', () => {
    const q = statsQueries(ctx, months)
    expect(q.monthly[0].merged).toContain('merged:2026-01-01..2026-01-31')
    expect(q.monthly[1].merged).toContain('merged:2026-02-01..2026-02-28')
  })

  it('dates reviews by updated, the only qualifier search offers', () => {
    const q = statsQueries(ctx, months)
    expect(q.monthly[0].reviewed).toContain('reviewed-by:octocat')
    expect(q.monthly[0].reviewed).toContain('updated:2026-01-01..2026-01-31')
    expect(q.monthly[0].reviewed).not.toContain('reviewed:2026')
  })

  it('windows the repo sample from the first covered month', () => {
    const q = statsQueries(ctx, months)
    expect(q.recentMerged).toContain('merged:>=2026-01-01')
  })

  it('keeps lifetime totals unbounded by date', () => {
    const q = statsQueries(ctx, months)
    expect(q.lifetimeAuthored).toBe('is:pr author:octocat org:acme-inc')
    expect(q.lifetimeReviewed).toBe('is:pr reviewed-by:octocat org:acme-inc')
  })
})

describe('monthAlias', () => {
  it('produces a legal GraphQL alias', () => {
    expect(monthAlias('merged', '2026-07')).toBe('merged_2026_07')
    // Aliases may not contain hyphens nor lead with a digit.
    expect(monthAlias('merged', '2026-07')).toMatch(/^[_A-Za-z][_0-9A-Za-z]*$/)
  })
})
