import { useCallback, useEffect, useRef, useState } from 'react'
import type { Credentials } from '../api/client'
import { fetchNotifications } from '../api/notifications'
import type { NotificationItem } from '../types'

export type NotificationsState = {
  items: NotificationItem[]
  /** GitHub's advertised minimum poll interval, once we have seen a response. */
  pollSeconds: number | null
  loading: boolean
  error: Error | null
  updatedAt: Date | null
  refresh: () => void
}

/**
 * Not built on useAsync because this endpoint is conditional-request aware: a 304
 * means "keep what you have" rather than "no results", so the previous items have
 * to survive the refresh.
 */
export function useNotifications(
  creds: Credentials,
  org: string,
  enabled: boolean,
): NotificationsState {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [pollSeconds, setPollSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [nonce, setNonce] = useState(0)

  const lastModified = useRef<string | null>(null)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const key = `${creds.token}|${creds.apiBaseUrl}|${org}`

  // Filtering happens client-side, so a changed org cannot be served from a 304 —
  // the raw feed is not retained. Declared before the fetch effect so the reset
  // lands first when both run on the same key change.
  useEffect(() => {
    lastModified.current = null
  }, [key])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchNotifications(creds, { org, lastModified: lastModified.current })
      .then((result) => {
        if (cancelled) return
        lastModified.current = result.lastModified
        setPollSeconds(result.pollSeconds)
        if (!result.unchanged) setItems(result.items)
        setUpdatedAt(new Date())
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `creds`/`org`.
  }, [key, enabled, nonce])

  return { items, pollSeconds, loading, error, updatedAt, refresh }
}
