import { useCallback, useEffect, useRef, useState } from 'react'
import type { Credentials } from '../api/client'
import { fetchNotifications, markThreadsRead } from '../api/notifications'
import type { NotificationItem } from '../types'

export type NotificationsState = {
  items: NotificationItem[]
  /** GitHub's advertised minimum poll interval, once we have seen a response. */
  pollSeconds: number | null
  loading: boolean
  error: Error | null
  updatedAt: Date | null
  refresh: () => void
  /** True while a mark-read request is in flight. */
  marking: boolean
  /** Resolves to how many threads could not be marked, so callers can report it. */
  markRead: (ids: string[]) => Promise<{ marked: number; failed: number }>
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

  const [marking, setMarking] = useState(false)

  const markRead = useCallback(
    async (ids: string[]): Promise<{ marked: number; failed: number }> => {
      if (ids.length === 0) return { marked: 0, failed: 0 }
      setMarking(true)
      setError(null)
      try {
        const { markedIds, failures } = await markThreadsRead(ids, creds)
        // Drop only what actually succeeded, so a failed thread stays visible
        // rather than silently vanishing while still unread on GitHub.
        const done = new Set(markedIds)
        setItems((prev) => prev.filter((item) => !done.has(item.id)))
        // The feed has changed, so the cached validator would wrongly yield a 304.
        lastModified.current = null
        if (failures.length > 0) {
          setError(
            new Error(
              `${failures.length} of ${ids.length} could not be marked read: ${failures[0].message}`,
            ),
          )
        }
        return { marked: markedIds.length, failed: failures.length }
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        return { marked: 0, failed: ids.length }
      } finally {
        setMarking(false)
      }
    },
    [creds],
  )

  return { items, pollSeconds, loading, error, updatedAt, refresh, marking, markRead }
}
