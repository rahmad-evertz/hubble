import type { PanelKey } from '../types'
import { monthRange } from './dates'
import { assertValidLogin } from './validate'

/**
 * Every GitHub search string the app issues is built here, from nothing but a
 * username and an org. Keeping these as pure functions means the query grammar
 * is unit-testable without a network, and it is the reason no organisation or
 * user is hard-coded anywhere in the source.
 */
export type QueryContext = { username: string; org: string }

type Scoped = { user: string; scope: string }

function resolve(ctx: QueryContext): Scoped {
  const user = assertValidLogin(ctx.username.trim(), 'Username')
  // An empty org deliberately widens the search to every repo the token can
  // see, rather than being an error.
  const org = ctx.org.trim() ? assertValidLogin(ctx.org.trim(), 'Organisation') : ''
  return { user, scope: org ? ` org:${org}` : '' }
}

/**
 * The four panels. `is:open` is load-bearing: without it these return lifetime
 * totals, and review-requested in particular accumulates forever through team
 * membership — thousands of rows where tens are meant.
 */
export function openPrQueries(ctx: QueryContext): Record<PanelKey, string> {
  const { user, scope } = resolve(ctx)
  const base = `is:pr is:open${scope} sort:updated-desc`
  return {
    mine: `${base} author:${user}`,
    requested: `${base} review-requested:${user}`,
    assigned: `${base} assignee:${user}`,
    mentioned: `${base} mentions:${user}`,
  }
}

/**
 * Exact count for the merged "My PRs" tab (authored ∪ assigned). Summing the
 * `mine` and `assigned` panel totals double-counts a PR that is both — this
 * asks GitHub's search index to dedupe instead, via its documented boolean
 * qualifier syntax, rather than approximating client-side from a page that
 * may not hold every match.
 */
export function myPrsQuery(ctx: QueryContext): string {
  const { user, scope } = resolve(ctx)
  return `is:pr is:open${scope} sort:updated-desc (author:${user} OR assignee:${user})`
}

export type MonthlyQueries = { key: string; merged: string; reviewed: string }

export type StatsQueries = {
  monthly: MonthlyQueries[]
  lifetimeAuthored: string
  lifetimeMerged: string
  lifetimeReviewed: string
  openAuthored: string
  /** Merged in the covered window, fetched as nodes so repos can be tallied. */
  recentMerged: string
}

/**
 * Stats are derived entirely from search because `contributionsCollection`
 * reports zeros for anyone whose contributions are all in private repos — it
 * moves the real number into `restrictedContributionsCount` and blanks every
 * breakdown field. Search has no such blind spot.
 */
export function statsQueries(ctx: QueryContext, months: string[]): StatsQueries {
  const { user, scope } = resolve(ctx)
  const windowStart = monthRange(months[0]).start

  return {
    monthly: months.map((key) => {
      const { start, end } = monthRange(key)
      return {
        key,
        merged: `is:pr is:merged author:${user}${scope} merged:${start}..${end}`,
        // No `reviewed:` date qualifier exists in GitHub search, so this buckets
        // by last PR activity instead of review date. Surfaced as approximate.
        reviewed: `is:pr reviewed-by:${user}${scope} updated:${start}..${end}`,
      }
    }),
    lifetimeAuthored: `is:pr author:${user}${scope}`,
    lifetimeMerged: `is:pr is:merged author:${user}${scope}`,
    lifetimeReviewed: `is:pr reviewed-by:${user}${scope}`,
    openAuthored: `is:pr is:open author:${user}${scope}`,
    recentMerged: `is:pr is:merged author:${user}${scope} merged:>=${windowStart}`,
  }
}

/**
 * GraphQL aliases cannot contain hyphens or lead with a digit, so a YYYY-MM key
 * needs mangling before it can label a batched sub-query.
 */
export function monthAlias(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/-/g, '_')}`
}
