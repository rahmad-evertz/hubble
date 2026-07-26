import type { NotificationItem } from '../types'
import { graphql, nextLink, pollIntervalSeconds, rest, type Credentials } from './client'

/** GitHub has no GraphQL notifications API, so this half of the app is REST. */
const PER_PAGE = 50
const DEFAULT_POLL_SECONDS = 60

type RawNotification = {
  id: string
  unread: boolean
  reason: string
  updated_at: string
  subject: { title: string; url: string | null; type: string }
  repository: { full_name: string; owner: { login: string } }
}

export type NotificationsResult = {
  items: NotificationItem[]
  /** GitHub's advertised minimum seconds between polls; callers must respect it. */
  pollSeconds: number
  /** Feed back as If-Modified-Since next time to earn free 304s. */
  lastModified: string | null
  /** Server reported nothing changed; keep whatever you already had. */
  unchanged: boolean
}

export type FetchOptions = {
  /** Blank shows every org the token can see. */
  org: string
  lastModified?: string | null
  /** Safety valve so a huge backlog cannot spin forever. */
  maxPages?: number
}

export async function fetchNotifications(
  creds: Credentials,
  { org, lastModified = null, maxPages = 5 }: FetchOptions,
): Promise<NotificationsResult> {
  const headers: Record<string, string> = {}
  if (lastModified) headers['If-Modified-Since'] = lastModified

  let url: string | null = `/notifications?all=false&per_page=${PER_PAGE}`
  const raw: RawNotification[] = []
  let poll = DEFAULT_POLL_SECONDS
  let newLastModified: string | null = null
  let pages = 0

  while (url && pages < maxPages) {
    const res = await rest<RawNotification[]>(url, creds, { headers })

    if (pages === 0) {
      poll = pollIntervalSeconds(res.headers, DEFAULT_POLL_SECONDS)
      newLastModified = res.headers.get('Last-Modified')
      // 304 only ever applies to the first page; nothing has changed at all.
      if (res.status === 304) {
        return { items: [], pollSeconds: poll, lastModified, unchanged: true }
      }
    }

    raw.push(...(res.data ?? []))
    url = nextLink(res.headers)
    pages++
  }

  const wanted = org
    ? raw.filter((n) => n.repository.owner.login.toLowerCase() === org.toLowerCase())
    : raw

  const resolved = await resolveSubjects(wanted, creds)

  const items: NotificationItem[] = wanted.map((n) => {
    const key = subjectKey(n)
    const extra = key ? resolved.get(key) : undefined
    return {
      id: n.id,
      reason: n.reason,
      unread: n.unread,
      updatedAt: n.updated_at,
      title: n.subject.title,
      subjectType: n.subject.type,
      repo: n.repository.full_name,
      url: extra?.url ?? null,
      isBot: extra?.isBot ?? null,
    }
  })

  return {
    items,
    pollSeconds: poll,
    lastModified: newLastModified ?? lastModified,
    unchanged: false,
  }
}

type SubjectRef = { owner: string; name: string; number: number; kind: 'pull' | 'issue' }
type SubjectInfo = { url: string; isBot: boolean }

/** `/repos/{owner}/{name}/pulls/{n}` or `.../issues/{n}` — other subjects have no number. */
function parseSubject(apiUrl: string | null): SubjectRef | null {
  if (!apiUrl) return null
  const match = /\/repos\/([^/]+)\/([^/]+)\/(pulls|issues)\/(\d+)/.exec(apiUrl)
  if (!match) return null
  return {
    owner: match[1],
    name: match[2],
    kind: match[3] === 'pulls' ? 'pull' : 'issue',
    number: Number(match[4]),
  }
}

function subjectKey(n: RawNotification): string | null {
  const ref = parseSubject(n.subject.url)
  return ref ? `${ref.owner}/${ref.name}#${ref.number}` : null
}

/**
 * Two things make this necessary rather than cosmetic: the notifications payload
 * carries an API URL but no `html_url`, so subjects are not clickable without a
 * lookup, and it names no author, so bot-ness is otherwise unknowable. Batched
 * into one aliased query it resolves ~40 subjects for a single rate-limit point.
 * CheckSuite, Release and Discussion subjects have no number and are skipped.
 */
async function resolveSubjects(
  raw: RawNotification[],
  creds: Credentials,
): Promise<Map<string, SubjectInfo>> {
  const refs = new Map<string, SubjectRef>()
  for (const n of raw) {
    const ref = parseSubject(n.subject.url)
    if (ref) refs.set(`${ref.owner}/${ref.name}#${ref.number}`, ref)
  }
  if (refs.size === 0) return new Map()

  const entries = [...refs.entries()]
  const selections = entries.map(([, ref], i) => {
    const field = ref.kind === 'pull' ? 'pullRequest' : 'issue'
    return `s${i}: repository(owner: "${ref.owner}", name: "${ref.name}") {
      ${field}(number: ${ref.number}) { url author { __typename } }
    }`
  })

  type Node = { url: string; author: { __typename: string } | null } | null
  const data = await graphql<Record<string, { pullRequest?: Node; issue?: Node } | null>>(
    `query { ${selections.join('\n')} rateLimit { cost remaining limit resetAt } }`,
    {},
    creds,
  )

  const out = new Map<string, SubjectInfo>()
  entries.forEach(([key], i) => {
    const holder = data[`s${i}`]
    const node = holder?.pullRequest ?? holder?.issue
    if (node) out.set(key, { url: node.url, isBot: node.author?.__typename === 'Bot' })
  })
  return out
}

/** Reasons ordered by how much they usually demand of you. */
const REASON_ORDER = [
  'review_requested',
  'mention',
  'assign',
  'author',
  'team_mention',
  'comment',
  'state_change',
  'ci_activity',
  'subscribed',
]

export function reasonRank(reason: string): number {
  const index = REASON_ORDER.indexOf(reason)
  return index === -1 ? REASON_ORDER.length : index
}

export const REASON_LABELS: Record<string, string> = {
  review_requested: 'Review requested',
  mention: 'Mentioned',
  team_mention: 'Team mentioned',
  assign: 'Assigned',
  author: 'Your thread',
  comment: 'New comment',
  state_change: 'State changed',
  ci_activity: 'CI activity',
  subscribed: 'Subscribed',
  security_alert: 'Security alert',
}

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}
