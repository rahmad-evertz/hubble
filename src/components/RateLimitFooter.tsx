import { useEffect, useState, type CSSProperties } from 'react'
import { onRateLimit } from '../api/client'
import type { RateLimitInfo } from '../types'

type Props = { notificationPollSeconds: number | null }

/**
 * Quota is always on screen rather than hidden in settings: a bug that re-fetches
 * in a loop is invisible until you watch this number fall.
 */
export default function RateLimitFooter({ notificationPollSeconds }: Props) {
  const [info, setInfo] = useState<RateLimitInfo | null>(null)

  useEffect(() => onRateLimit(setInfo), [])

  // Guarded: a zero limit would give NaN, and calc(NaN * 100%) invalidates
  // the whole declaration.
  const quota = info && info.limit > 0 ? Math.max(0, Math.min(1, info.remaining / info.limit)) : 1

  return (
    <footer className="footer" style={{ '--quota': quota } as CSSProperties}>
      <span>Hubble reads GitHub directly from this browser. Nothing is stored anywhere else.</span>
      <span className="sep">·</span>
      {info ? (
        <span>
          GraphQL quota <strong>{info.remaining.toLocaleString()}</strong> /{' '}
          {info.limit.toLocaleString()}
          {info.cost > 0 && ` (last request cost ${info.cost})`} · resets{' '}
          {new Date(info.resetAt).toLocaleTimeString()}
        </span>
      ) : (
        <span>GraphQL quota unknown</span>
      )}
      {notificationPollSeconds !== null && (
        <>
          <span className="sep">·</span>
          <span>GitHub minimum notification poll {notificationPollSeconds}s</span>
        </>
      )}
    </footer>
  )
}
