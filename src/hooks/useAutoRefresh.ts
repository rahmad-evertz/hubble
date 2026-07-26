import { useEffect, useRef } from 'react'

/**
 * Calls `callback` every `seconds`. The callback is held in a ref so that a new
 * closure each render does not restart the timer — otherwise a dashboard that
 * re-renders often would never actually reach its interval.
 */
export function useAutoRefresh(callback: () => void, seconds: number, enabled: boolean): void {
  const latest = useRef(callback)

  useEffect(() => {
    latest.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || seconds <= 0) return
    const id = setInterval(() => latest.current(), seconds * 1000)
    return () => clearInterval(id)
  }, [seconds, enabled])
}
