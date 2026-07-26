/** Runtime configuration. Never baked into the build — see lib/config.ts. */
export type AppConfig = {
  githubToken: string
  username: string
  org: string
  apiBaseUrl: string
  /** Optional issue-key linking, e.g. "([A-Z]{2,}-\\d+)". Empty = feature off. */
  ticketPattern: string
  /** Base URL the extracted key is appended to. Empty = feature off. */
  ticketBaseUrl: string
}

export type PanelKey = 'mine' | 'requested' | 'assigned' | 'mentioned'

/** Why a PR is in your dashboard. A PR can carry several at once. */
export type PrRole = 'author' | 'reviewer' | 'assignee' | 'mentioned'

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null

export type CheckState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null

export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'

export type Mergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'

export type Reviewer = { login: string; avatarUrl: string }

export type PullRequest = {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  /** owner/name */
  repo: string
  authorLogin: string | null
  /** From GraphQL `author.__typename === 'Bot'` — no title heuristics needed. */
  authorIsBot: boolean
  reviewDecision: ReviewDecision
  mergeable: Mergeable
  additions: number
  deletions: number
  changedFiles: number
  /** The configured user's own latest review, via reviews(author:). */
  userLatestReview: ReviewState | null
  checkState: CheckState
  waitingOn: Reviewer[]
  roles: PrRole[]
}

export type RateLimitInfo = {
  cost: number
  remaining: number
  limit: number
  resetAt: string
}

export type PanelResult = {
  /** Server-side total, which can exceed the number of nodes fetched. */
  total: number
  prs: PullRequest[]
  hasMore: boolean
}

export type Panels = Record<PanelKey, PanelResult>

export type NotificationItem = {
  id: string
  reason: string
  unread: boolean
  updatedAt: string
  title: string
  /** PullRequest | Issue | Release | Discussion | CheckSuite … */
  subjectType: string
  repo: string
  /** Resolved web URL, or null when the subject has no addressable page. */
  url: string | null
  /** null when we could not determine it (subject not among loaded PRs). */
  isBot: boolean | null
}

export type MonthBucket = {
  /** YYYY-MM */
  key: string
  merged: number
  /** Approximate — GitHub search has no `reviewed:` date qualifier. */
  reviewedApprox: number
}

export type RepoCount = { repo: string; count: number }

export type Stats = {
  months: MonthBucket[]
  lifetime: {
    authored: number
    merged: number
    reviewed: number
    openAuthored: number
  }
  topRepos: RepoCount[]
}
