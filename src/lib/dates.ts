/** All bucketing is UTC so a dashboard reads the same regardless of viewer timezone. */

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM keys for the last `count` months, oldest first, including the current month. */
export function monthKeys(count: number, now: Date = new Date()): string[] {
  const keys: string[] = []
  for (let back = count - 1; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`)
  }
  return keys
}

/**
 * Inclusive YYYY-MM-DD bounds for a month key, for GitHub's `merged:a..b` syntax.
 * The end date is the real last day of the month even for the current month:
 * GitHub accepts ranges extending into the future and it keeps buckets stable.
 */
export function monthRange(key: string): { start: string; end: string } {
  const [year, month] = key.split('-').map(Number)
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${key}-01`, end: `${key}-${pad(lastDay)}` }
}

/** Short month label for axes, e.g. "Jul". */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'short',
    timeZone: 'UTC',
  })
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Compact relative age: "just now", "14m", "3h", "11d", "4mo". */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const delta = now.getTime() - new Date(iso).getTime()
  if (delta < MINUTE) return 'just now'
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`
  const days = Math.floor(delta / DAY)
  if (days < 60) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

/** Whole days since `iso`, used for age colour thresholds. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY)
}
