import type { RateLimitInfo } from '../types'

export const DEFAULT_API_BASE = 'https://api.github.com'

/** The token is absent, invalid, or was revoked — the caller should re-run setup. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class GitHubError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

export type Credentials = { token: string; apiBaseUrl: string }

type Listener = (info: RateLimitInfo) => void
const listeners = new Set<Listener>()

/** Subscribe to quota updates scraped off every GraphQL response. */
export function onRateLimit(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function baseHeaders(token: string): Record<string, string> {
  return {
    // Bearer covers both classic and fine-grained tokens.
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

const AUTH_HINT =
  'GitHub rejected the token. It may be expired, revoked, or missing the repo and read:org scopes.'

/**
 * The GraphQL endpoint answers 502 when a query takes too long server-side, and
 * a four-alias search over a large org does that intermittently. Every request
 * here is a read, so retrying is safe and turns a visible failure into a hiccup.
 */
const RETRY_STATUSES = new Set([502, 503, 504])

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | undefined
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, init)
    if (!RETRY_STATUSES.has(res.status)) return res
    last = res
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt))
    }
  }
  return last as Response
}

type GraphQLBody<T> = {
  data?: T & { rateLimit?: RateLimitInfo }
  errors?: { message: string; type?: string }[]
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  creds: Credentials,
): Promise<T> {
  const res = await fetchWithRetry(`${creds.apiBaseUrl}/graphql`, {
    method: 'POST',
    headers: { ...baseHeaders(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 401) throw new AuthError(AUTH_HINT)
  if (!res.ok) {
    throw new GitHubError(`GitHub GraphQL responded ${res.status} ${res.statusText}.`, res.status)
  }

  const body = (await res.json()) as GraphQLBody<T>
  if (body.data?.rateLimit) {
    for (const fn of listeners) fn(body.data.rateLimit)
  }

  if (body.errors?.length) {
    const message = body.errors.map((e) => e.message).join('; ')
    // GraphQL routinely returns partial data alongside errors — a search touching
    // one inaccessible repo should not blank the whole dashboard.
    if (!body.data) throw new GitHubError(message)
    console.warn(`[hubble] partial GraphQL response: ${message}`)
  }

  if (!body.data) throw new GitHubError('GitHub returned an empty GraphQL response.')
  return body.data
}

export type RestResult<T> = {
  /** null on 304 Not Modified, where the caller should keep its cached copy. */
  data: T | null
  status: number
  headers: Headers
}

export async function rest<T>(
  pathOrUrl: string,
  creds: Credentials,
  init: RequestInit = {},
): Promise<RestResult<T>> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${creds.apiBaseUrl}${pathOrUrl}`
  const res = await fetchWithRetry(url, {
    ...init,
    headers: { ...baseHeaders(creds.token), ...(init.headers as Record<string, string>) },
  })

  if (res.status === 401) throw new AuthError(AUTH_HINT)
  // A 304 costs no rate limit, which is why notifications always send
  // If-Modified-Since. It is a success, not an error.
  if (res.status === 304) return { data: null, status: 304, headers: res.headers }
  if (!res.ok) {
    throw new GitHubError(`GitHub responded ${res.status} ${res.statusText}.`, res.status)
  }

  return { data: (await res.json()) as T, status: res.status, headers: res.headers }
}

/** Follow RFC 5988 pagination. Requires `Link` to be CORS-exposed, which it is. */
export function nextLink(headers: Headers): string | null {
  const link = headers.get('Link')
  if (!link) return null
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/)
    if (match) return match[1]
  }
  return null
}

/**
 * GitHub advertises a minimum polling interval for the notifications endpoint.
 * Honouring it is a condition of using the API politely, so callers clamp their
 * own refresh interval to whatever this returns.
 */
export function pollIntervalSeconds(headers: Headers, fallback: number): number {
  const raw = headers.get('X-Poll-Interval')
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
