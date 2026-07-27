import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  updatedAt: Date | null
}

export type AsyncResource<T> = AsyncState<T> & {
  refresh: () => void
  mutate: (updater: (prev: T | null) => T | null) => void
}

/**
 * One fetch-with-refresh, shared by the panels and stats.
 *
 * `key` is a caller-supplied identity for the request. The `load` closure is
 * rebuilt on every render, so it cannot be an effect dependency without
 * re-fetching forever; `key` is what actually decides when to re-run.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  key: string,
  enabled: boolean,
): AsyncResource<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    updatedAt: null,
  })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const mutate = useCallback((updater: (prev: T | null) => T | null) => {
    setState((s) => ({ ...s, data: updater(s.data) }))
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    load()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null, updatedAt: new Date() })
      })
      .catch((error: Error) => {
        // Keep the last good data on screen; a failed refresh should not blank
        // a dashboard you were reading.
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error }))
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `load`.
  }, [key, enabled, nonce])

  return { ...state, refresh, mutate }
}
