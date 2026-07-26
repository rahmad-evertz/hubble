import { monthKeys } from '../lib/dates'
import { monthAlias, statsQueries, type QueryContext } from '../lib/queries'
import type { MonthBucket, RepoCount, Stats } from '../types'
import { graphql, type Credentials } from './client'

export const MONTHS_COVERED = 12
const TOP_REPOS = 8
/** Search caps a page at 100, which also bounds how many repos we can tally. */
const REPO_SAMPLE = 100

type CountNode = { issueCount: number }
type RepoNode = { repository?: { nameWithOwner: string } } | null

/**
 * Builds one document with a variable per sub-query. Passing the search strings
 * as variables rather than interpolating them keeps user-supplied names out of
 * the query text entirely, which matters because the org and username come from
 * a text field.
 */
class BatchedSearch {
  private index = 0
  readonly variables: Record<string, string> = {}
  private declarations: string[] = []
  private selections: string[] = []

  add(alias: string, query: string, first: number, fields: string): void {
    const name = `q${this.index++}`
    this.variables[name] = query
    this.declarations.push(`$${name}: String!`)
    this.selections.push(
      `${alias}: search(query: $${name}, type: ISSUE, first: ${first}) { ${fields} }`,
    )
  }

  document(): string {
    return `query Stats(${this.declarations.join(', ')}) {
      ${this.selections.join('\n')}
      rateLimit { cost remaining limit resetAt }
    }`
  }
}

export async function fetchStats(
  ctx: QueryContext,
  creds: Credentials,
  now: Date = new Date(),
): Promise<Stats> {
  const keys = monthKeys(MONTHS_COVERED, now)
  const queries = statsQueries(ctx, keys)
  const batch = new BatchedSearch()

  // `first: 0` returns the count without any nodes, which is all a bucket needs.
  for (const month of queries.monthly) {
    batch.add(monthAlias('merged', month.key), month.merged, 0, 'issueCount')
    batch.add(monthAlias('reviewed', month.key), month.reviewed, 0, 'issueCount')
  }
  batch.add('lifetimeAuthored', queries.lifetimeAuthored, 0, 'issueCount')
  batch.add('lifetimeMerged', queries.lifetimeMerged, 0, 'issueCount')
  batch.add('lifetimeReviewed', queries.lifetimeReviewed, 0, 'issueCount')
  batch.add('openAuthored', queries.openAuthored, 0, 'issueCount')
  batch.add(
    'recentMerged',
    queries.recentMerged,
    REPO_SAMPLE,
    'issueCount nodes { ... on PullRequest { repository { nameWithOwner } } }',
  )

  const data = await graphql<Record<string, CountNode & { nodes?: RepoNode[] }>>(
    batch.document(),
    batch.variables,
    creds,
  )

  const count = (alias: string): number => data[alias]?.issueCount ?? 0

  const months: MonthBucket[] = keys.map((key) => ({
    key,
    merged: count(monthAlias('merged', key)),
    reviewedApprox: count(monthAlias('reviewed', key)),
  }))

  const tally = new Map<string, number>()
  for (const node of data.recentMerged?.nodes ?? []) {
    const repo = node?.repository?.nameWithOwner
    if (repo) tally.set(repo, (tally.get(repo) ?? 0) + 1)
  }
  const topRepos: RepoCount[] = [...tally]
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo))
    .slice(0, TOP_REPOS)

  return {
    months,
    lifetime: {
      authored: count('lifetimeAuthored'),
      merged: count('lifetimeMerged'),
      reviewed: count('lifetimeReviewed'),
      openAuthored: count('openAuthored'),
    },
    topRepos,
  }
}

/**
 * True when the repo tally is drawn from a truncated sample, so the UI can say
 * so rather than implying the top-repos list is exhaustive.
 */
export function repoTallyTruncated(stats: Stats): boolean {
  return stats.months.reduce((sum, m) => sum + m.merged, 0) > REPO_SAMPLE
}
