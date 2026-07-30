import { myPrsQuery, openPrQueries, type QueryContext } from '../lib/queries'
import type {
  CheckState,
  Mergeable,
  PanelKey,
  Panels,
  PanelsData,
  PrRole,
  PullRequest,
  ReviewDecision,
  ReviewState,
  Reviewer,
} from '../types'
import { graphql, type Credentials } from './client'

export const PANEL_KEYS: PanelKey[] = ['mine', 'requested', 'assigned', 'mentioned']

/** Which panel a PR arrived through is what tells us your relationship to it. */
const PANEL_ROLE: Record<PanelKey, PrRole> = {
  mine: 'author',
  requested: 'reviewer',
  assigned: 'assignee',
  mentioned: 'mentioned',
}

/**
 * `reviews(author: $login)` rather than `viewerLatestReview`: the latter reports
 * the token owner's review, which is wrong whenever the dashboard is pointed at
 * a username other than the token's own.
 */
const PR_FRAGMENT = `
fragment PrPage on SearchResultItemConnection {
  issueCount
  pageInfo { hasNextPage endCursor }
  nodes {
    ... on PullRequest {
      id
      number
      title
      url
      isDraft
      createdAt
      updatedAt
      repository { nameWithOwner }
      author { login __typename }
      reviewDecision
      mergeable
      additions
      deletions
      changedFiles
      reviews(last: 1, author: $login) { nodes { state } }
      reviewRequests(first: 10) {
        nodes { requestedReviewer { ... on User { login avatarUrl } } }
      }
      commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
    }
  }
}`

/**
 * All four panels in one request. Aliased sub-queries share a rate-limit cost of
 * a single point, so splitting these would be strictly more expensive.
 */
const PANELS_QUERY = `
query Panels(
  $mine: String!
  $requested: String!
  $assigned: String!
  $mentioned: String!
  $myPrs: String!
  $login: String!
  $first: Int!
) {
  mine:       search(query: $mine,      type: ISSUE, first: $first) { ...PrPage }
  requested:  search(query: $requested, type: ISSUE, first: $first) { ...PrPage }
  assigned:   search(query: $assigned,  type: ISSUE, first: $first) { ...PrPage }
  mentioned:  search(query: $mentioned, type: ISSUE, first: $first) { ...PrPage }
  myPrsTotal: search(query: $myPrs,     type: ISSUE, first: 0)      { issueCount }
  rateLimit { cost remaining limit resetAt }
}
${PR_FRAGMENT}`

type RawNode = {
  id?: string
  number?: number
  title?: string
  url?: string
  isDraft?: boolean
  createdAt?: string
  updatedAt?: string
  repository?: { nameWithOwner: string }
  author?: { login: string; __typename: string } | null
  reviewDecision?: ReviewDecision
  mergeable?: Mergeable
  additions?: number
  deletions?: number
  changedFiles?: number
  reviews?: { nodes: { state: ReviewState }[] } | null
  reviewRequests?: { nodes: { requestedReviewer: Partial<Reviewer> | null }[] } | null
  commits?: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] } | null
}

type RawPage = {
  issueCount: number
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  nodes: RawNode[]
}

type PanelsResponse = Record<PanelKey, RawPage> & { myPrsTotal?: { issueCount: number } }

/** `type: ISSUE` can return Issues too; non-PR nodes arrive as empty objects. */
function isPullRequest(node: RawNode): node is RawNode & { id: string } {
  return typeof node.id === 'string' && typeof node.number === 'number'
}

function toPullRequest(node: RawNode & { id: string }, roles: Set<PrRole>): PullRequest {
  const reviewers: Reviewer[] = (node.reviewRequests?.nodes ?? [])
    .map((entry) => entry.requestedReviewer)
    // Teams and bots can be requested reviewers; only Users have a login here.
    .filter((r): r is Reviewer => Boolean(r?.login && r.avatarUrl))

  return {
    id: node.id,
    number: node.number!,
    title: node.title ?? '',
    url: node.url ?? '',
    isDraft: node.isDraft ?? false,
    createdAt: node.createdAt ?? '',
    updatedAt: node.updatedAt ?? '',
    repo: node.repository?.nameWithOwner ?? '',
    authorLogin: node.author?.login ?? null,
    authorIsBot: node.author?.__typename === 'Bot',
    reviewDecision: node.reviewDecision ?? null,
    mergeable: node.mergeable ?? 'UNKNOWN',
    additions: node.additions ?? 0,
    deletions: node.deletions ?? 0,
    changedFiles: node.changedFiles ?? 0,
    userLatestReview: node.reviews?.nodes?.[0]?.state ?? null,
    checkState: node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null,
    waitingOn: reviewers,
    roles: [...roles],
  }
}

export async function fetchPanels(
  ctx: QueryContext,
  creds: Credentials,
  // Each node also resolves reviews/reviewRequests/commits->statusCheckRollup,
  // so this multiplies query cost across 4 panels; kept modest to keep the
  // load fast and under GitHub's server-side timeout for this query shape.
  first = 20,
): Promise<PanelsData> {
  const queries = openPrQueries(ctx)
  const data = await graphql<PanelsResponse>(
    PANELS_QUERY,
    { ...queries, myPrs: myPrsQuery(ctx), login: ctx.username.trim(), first },
    creds,
  )

  // Union roles across panels first, so a PR you authored *and* were mentioned
  // in shows both badges no matter which panel you happen to be looking at.
  const rolesById = new Map<string, Set<PrRole>>()
  for (const key of PANEL_KEYS) {
    for (const node of data[key]?.nodes ?? []) {
      if (!isPullRequest(node)) continue
      const set = rolesById.get(node.id) ?? new Set<PrRole>()
      set.add(PANEL_ROLE[key])
      rolesById.set(node.id, set)
    }
  }

  const byId = new Map<string, PullRequest>()
  const panels = {} as Panels
  for (const key of PANEL_KEYS) {
    const page = data[key]
    const prs = (page?.nodes ?? [])
      .filter(isPullRequest)
      .map((node) => toPullRequest(node, rolesById.get(node.id) ?? new Set([PANEL_ROLE[key]])))
    for (const pr of prs) byId.set(pr.id, pr)
    panels[key] = {
      // The server-side total can exceed what we fetched, so it is reported
      // separately rather than inferred from the row count.
      total: page?.issueCount ?? 0,
      prs,
      hasMore: page?.pageInfo?.hasNextPage ?? false,
    }
  }

  return { panels, all: [...byId.values()], myPrsTotal: data.myPrsTotal?.issueCount ?? 0 }
}

/**
 * Dedupes across panels for display. Each PR's `roles` is already unioned
 * across all four panels above, so no role-merging is needed here — just
 * one pass keeping first-seen order across the given keys.
 */
export function combinePanelPrs(data: PanelsData | null, keys: PanelKey[]): PullRequest[] {
  if (!data) return []
  const seen = new Set<string>()
  const out: PullRequest[] = []
  for (const key of keys) {
    for (const pr of data.panels[key].prs) {
      if (seen.has(pr.id)) continue
      seen.add(pr.id)
      out.push(pr)
    }
  }
  return out
}

export function patchPanelsPr(
  data: PanelsData | null,
  id: string,
  patch: Partial<PullRequest>,
): PanelsData | null {
  if (!data) return data
  const panels = {} as Panels
  for (const key of PANEL_KEYS) {
    panels[key] = {
      ...data.panels[key],
      prs: data.panels[key].prs.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)),
    }
  }
  return {
    panels,
    all: data.all.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)),
    myPrsTotal: data.myPrsTotal,
  }
}

export function removePanelsPr(data: PanelsData | null, id: string): PanelsData | null {
  if (!data) return data
  // The merged "My PRs" tab counts this PR once whether it was in mine,
  // assigned, or both — check before either panel's list is filtered below.
  const wasMyPr =
    data.panels.mine.prs.some((pr) => pr.id === id) ||
    data.panels.assigned.prs.some((pr) => pr.id === id)

  const panels = {} as Panels
  for (const key of PANEL_KEYS) {
    const prs = data.panels[key].prs.filter((pr) => pr.id !== id)
    const dropped = prs.length < data.panels[key].prs.length
    panels[key] = {
      ...data.panels[key],
      prs,
      total: dropped ? Math.max(0, data.panels[key].total - 1) : data.panels[key].total,
    }
  }
  return {
    panels,
    all: data.all.filter((pr) => pr.id !== id),
    myPrsTotal: wasMyPr ? Math.max(0, data.myPrsTotal - 1) : data.myPrsTotal,
  }
}
